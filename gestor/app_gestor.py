from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from database import SessionLocal, Cliente, UnidadeConsumidora, Fatura, engine
from energisa_client import EnergisaGatewayClient
import base64
import json
import os
from datetime import datetime

app = FastAPI(title="Gestor de Faturas SaaS")
gateway = EnergisaGatewayClient()

# Habilita CORS para o Frontend acessar
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

# --- ROTAS DE CADASTRO E LOGIN ---

@app.post("/empresas/novo")
def registrar_empresa(nome: str, cpf: str, telefone_final: str, db: Session = Depends(get_db)):
    cliente = Cliente(nome_empresa=nome, responsavel_cpf=cpf, telefone_login=telefone_final, ultimo_login=datetime.now())
    db.add(cliente)
    db.commit()
    return {"msg": "Empresa cadastrada", "id": cliente.id}

@app.post("/empresas/{id}/conectar")
def iniciar_conexao_energisa(id: int, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == id).first()
    if not cliente: raise HTTPException(404, "Cliente não encontrado")
    
    try:
        # Se já tiver sessão válida, pula o SMS e sincroniza direto
        # (Aqui simplificamos chamando start_login, mas em produção você pode checar antes)
        resp = gateway.start_login(cliente.responsavel_cpf, cliente.telefone_login)
        
        cliente.transaction_id = resp["transaction_id"]
        cliente.status_conexao = "AGUARDANDO_SMS"
        db.commit()
        return {"msg": "SMS Enviado", "transaction_id": resp["transaction_id"]}
    except Exception as e:
        # Se der erro, talvez já esteja logado ou erro real. 
        # Vamos tentar sincronizar mesmo assim para casos de "re-connect" sem SMS
        sincronizar_dados_cliente(cliente.id)
        return {"msg": "Tentativa de conexão direta iniciada (ou erro no Gateway).", "details": str(e)}

@app.post("/empresas/{id}/validar-sms")
def validar_sms(id: int, codigo_sms: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == id).first()
    try:
        gateway.finish_login(cliente.responsavel_cpf, cliente.transaction_id, codigo_sms)
        cliente.status_conexao = "CONECTADO"
        cliente.ultimo_login = datetime.now()
        db.commit()
        
        background_tasks.add_task(sincronizar_dados_cliente, cliente.id)
        return {"msg": "Conectado! Sincronização iniciada."}
    except Exception as e:
        raise HTTPException(400, f"Falha no login: {str(e)}")

# --- ROTAS DE LEITURA (FRONTEND) ---

@app.get("/empresas")
def listar_empresas(db: Session = Depends(get_db)):
    return db.query(Cliente).all()

@app.get("/empresas/{cliente_id}/ucs")
def listar_ucs_cliente(cliente_id: int, db: Session = Depends(get_db)):
    """Retorna UCs do cliente (para a lista geral)"""
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente: raise HTTPException(404, "Cliente não encontrado")
    return cliente.unidades

@app.get("/empresas/{cliente_id}/usinas")
def listar_usinas_arvore(cliente_id: int, db: Session = Depends(get_db)):
    """Retorna apenas GERADORAS com suas BENEFICIÁRIAS (Árvore)"""
    usinas = db.query(UnidadeConsumidora).filter(
        UnidadeConsumidora.cliente_id == cliente_id,
        UnidadeConsumidora.is_geradora == True
    ).options(joinedload(UnidadeConsumidora.beneficiarias)).all()
    return usinas

@app.get("/ucs/{uc_id}/faturas")
def listar_faturas_uc(uc_id: int, db: Session = Depends(get_db)):
    """Lazy Loading das faturas"""
    return db.query(Fatura).filter(Fatura.uc_id == uc_id).order_by(Fatura.ano.desc(), Fatura.mes.desc()).all()

@app.get("/faturas/{id}/download")
def baixar_pdf_fatura(id: int, db: Session = Depends(get_db)):
    """Baixa PDF (do disco ou da Energisa)"""
    fatura = db.query(Fatura).filter(Fatura.id == id).first()
    if not fatura: raise HTTPException(404, "Fatura não encontrada")
    
    pasta = "faturas_storage"
    os.makedirs(pasta, exist_ok=True)
    filename_local = f"{pasta}/fatura_{fatura.uc.cdc}_{fatura.mes}-{fatura.ano}.pdf"
    
    if not os.path.exists(filename_local):
        try:
            cli = fatura.uc.cliente
            res = gateway.download_fatura(
                cli.responsavel_cpf,
                {"cdc": fatura.uc.cdc, "empresa_web": fatura.uc.empresa_web, "digito_verificador": fatura.uc.digito_verificador},
                {"mes": fatura.mes, "ano": fatura.ano, "numero_fatura": fatura.numero_fatura}
            )
            if res and "file_base64" in res:
                with open(filename_local, "wb") as f:
                    f.write(base64.b64decode(res["file_base64"]))
                fatura.arquivo_pdf_path = filename_local
                db.commit()
            else: raise Exception("Arquivo não retornado")
        except Exception as e:
            raise HTTPException(500, f"Erro no download: {e}")

    with open(filename_local, "rb") as f:
        return {
            "filename": f"Fatura_{fatura.uc.cdc}_{fatura.mes}-{fatura.ano}.pdf",
            "file_base64": base64.b64encode(f.read()).decode('utf-8')
        }

# --- A FUNÇÃO MÁGICA DE SINCRONIZAÇÃO (COMPLETA) ---

def sincronizar_dados_cliente(cliente_id: int):
    db = SessionLocal()
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    print(f"🔄 Sincronizando cliente {cliente.nome_empresa}...")
    
    try:
        ucs_remotas = gateway.list_ucs(cliente.responsavel_cpf)
        
        # Validação se o Gateway retornou erro
        if isinstance(ucs_remotas, dict) and "detail" in ucs_remotas:
             print(f"❌ Erro ao buscar UCs: {ucs_remotas['detail']}")
             return

        print(f"   📋 Encontradas {len(ucs_remotas)} UCs remotas.")
        
        for uc_data in ucs_remotas:
            # 1. TRATAMENTO DE DADOS BÁSICOS
            raw_end = uc_data.get('endereco')
            endereco_final = raw_end.get('descricao', "") if isinstance(raw_end, dict) else str(raw_end)
            
            cdc_real = uc_data.get('cdc') or uc_data.get('numeroUc')
            digito_real = uc_data.get('digitoVerificador')
            if digito_real is None: digito_real = uc_data.get('digitoVerificadorCdc')
            if digito_real is None: digito_real = 0

            # 2. SALVAR/ATUALIZAR UC PRINCIPAL
            uc_local = db.query(UnidadeConsumidora).filter_by(codigo_uc=uc_data['numeroUc']).first()
            if not uc_local:
                uc_local = UnidadeConsumidora(
                    cliente_id=cliente.id,
                    codigo_uc=uc_data.get('numeroUc'),
                    cdc=cdc_real,
                    digito_verificador=digito_real,
                    empresa_web=uc_data.get('codigoEmpresaWeb', 6),
                    endereco=endereco_final,
                    nome_titular=uc_data.get('nomeTitular')
                )
                db.add(uc_local)
                db.commit()
                db.refresh(uc_local)
                print(f"   ✅ UC {uc_local.codigo_uc} cadastrada.")

            # 3. LÓGICA SOLAR (GERAÇÃO DISTRIBUÍDA)
            gd_code = uc_data.get('geracaoDistribuida')
            eh_geradora = False
            
            # Se for geradora, busca detalhes e filhos
            if gd_code and str(gd_code) == str(uc_data.get('numeroUc')):
                eh_geradora = True
                print(f"   ☀️ UC {cdc_real} é USINA! Buscando dados solares...")
                try:
                    gd_info = gateway.get_gd_info(cliente.responsavel_cpf, {
                        "cdc": cdc_real, "empresa_web": uc_local.empresa_web, "digitoVerificadorCdc": digito_real
                    })
                    
                    if gd_info and 'infos' in gd_info:
                        obj = gd_info['infos'].get('objeto', {})
                        uc_local.saldo_acumulado = obj.get('qtdKwhSaldo', 0)
                        uc_local.tipo_geracao = obj.get('tipoGeracao')
                        uc_local.is_geradora = True
                        
                        # Processar Beneficiárias (Filhas)
                        for ben in obj.get('listaBeneficiarias', []):
                            ben_cdc = ben.get('cdc')
                            uc_filha = db.query(UnidadeConsumidora).filter_by(cdc=ben_cdc).first()
                            
                            if not uc_filha:
                                uc_filha = UnidadeConsumidora(
                                    cliente_id=cliente.id,
                                    codigo_uc=ben_cdc, 
                                    cdc=ben_cdc,
                                    digito_verificador=ben.get('digitoVerificador', 0),
                                    empresa_web=ben.get('codigoEmpresaWeb', 6),
                                    endereco=ben.get('endereco', 'Endereço da Beneficiária'),
                                    nome_titular=ben.get('nome')
                                )
                                db.add(uc_filha)
                            
                            # Vincula ao Pai
                            uc_filha.geradora_id = uc_local.id
                            uc_filha.percentual_rateio = ben.get('percentualRecebido', 0)
                        
                        db.commit()
                except Exception as e:
                    print(f"      ⚠️ Erro na busca solar: {e}")

            # 4. BUSCA FATURAS (AQUI ESTÁ ELA DE VOLTA!)
            print(f"   🔎 Buscando faturas da UC {uc_local.cdc}...")
            try:
                faturas_remotas = gateway.list_faturas(cliente.responsavel_cpf, {
                    "cdc": uc_local.cdc,
                    "empresa_web": uc_local.empresa_web,
                    "digito_verificador": uc_local.digito_verificador
                })
                
                # Se der erro 500 ou não for lista, pula sem quebrar tudo
                if not isinstance(faturas_remotas, list):
                    print(f"      ⚠️ Pular faturas: Resposta inválida ou erro da Energisa.")
                else:
                    count = 0
                    for fat in faturas_remotas:
                        # Evita duplicidade
                        if not db.query(Fatura).filter_by(uc_id=uc_local.id, numero_fatura=fat.get('numeroFatura')).first():
                            # Trata Datas
                            dt_venc = None
                            if fat.get('dataVencimentoISO'):
                                try: dt_venc = datetime.fromisoformat(fat.get('dataVencimentoISO')).date()
                                except: pass
                            
                            dt_leit = None
                            if fat.get('dataLeituraISO'):
                                try: dt_leit = datetime.fromisoformat(fat.get('dataLeituraISO')).date()
                                except: pass

                            nova_fatura = Fatura(
                                uc_id=uc_local.id,
                                mes=fat.get('mesReferencia'),
                                ano=fat.get('anoReferencia'),
                                valor=fat.get('valorFatura'),
                                status=fat.get('situacaoPagamento'),
                                numero_fatura=fat.get('numeroFatura'),
                                vencimento=dt_venc,
                                data_leitura=dt_leit,
                                consumo_kwh=fat.get('consumo'),
                                codigo_barras=fat.get('codigoBarra'),
                                pix_copia_cola=fat.get('qrCodePix'),
                                detalhes_json=json.dumps(fat.get('detalhamentoFatura', {}))
                            )
                            db.add(nova_fatura)
                            count += 1
                    db.commit()
                    print(f"      💰 {count} novas faturas salvas.")

            except Exception as e:
                print(f"      ⚠️ Erro ao baixar faturas desta UC: {e}")

    except Exception as e:
        print(f"❌ Erro crítico sync: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()