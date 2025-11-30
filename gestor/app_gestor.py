from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import or_, and_, func
from pydantic import ValidationError
from database import SessionLocal, Cliente, UnidadeConsumidora, Fatura, Usuario, SolicitacaoGestor, Lead, InteracaoLead
from energisa_client import EnergisaGatewayClient
from auth import get_usuario_atual, get_db
from schemas import (
    ClienteCreate, ValidarSmsRequest, MensagemResponse, SyncStatusResponse,
    SolicitarGestorRequest, ValidarCodigoGestorRequest, SolicitacaoGestorResponse,
    LeadResponse, LeadUpdate, InteracaoLeadCreate, InteracaoLeadResponse
)
from routes_auth import router as auth_router
import base64
import json
import os
import traceback
from datetime import datetime, timedelta
from typing import List, Optional

app = FastAPI(title="Gestor de Faturas SaaS - Enterprise Edition")
gateway = EnergisaGatewayClient()

# Inclui rotas de autenticacao
app.include_router(auth_router)

# Configuracao de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# HELPER: Verificar propriedade do recurso
# ==========================================

def verificar_cliente_pertence_usuario(cliente: Cliente, usuario: Usuario):
    """Verifica se o cliente pertence ao usuario logado"""
    if cliente.usuario_id != usuario.id:
        raise HTTPException(403, "Acesso negado a este recurso")


def verificar_superadmin(usuario: Usuario):
    """Verifica se o usuario e super admin"""
    if not usuario.is_superadmin:
        raise HTTPException(403, "Acesso negado. Apenas super admins podem acessar este recurso.")


# ==========================================
# 1. ROTAS DE LEITURA (PROTEGIDAS)
# ==========================================

@app.get("/empresas")
def listar_empresas(
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """Lista apenas as empresas do usuario logado (multi-tenant)"""
    try:
        return db.query(Cliente).filter(Cliente.usuario_id == usuario.id).all()
    except SQLAlchemyError as e:
        raise HTTPException(500, f"Erro ao consultar banco de dados: {str(e)}")


@app.get("/empresas/{cliente_id}")
def obter_empresa(
    cliente_id: int,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """Obter dados de uma empresa especifica, incluindo status de sync"""
    try:
        cliente = db.query(Cliente).filter(
            Cliente.id == cliente_id,
            Cliente.usuario_id == usuario.id
        ).first()
        if not cliente:
            raise HTTPException(404, "Cliente nao encontrado")
        return cliente
    except SQLAlchemyError as e:
        raise HTTPException(500, f"Erro ao consultar banco de dados: {str(e)}")


@app.get("/empresas/{cliente_id}/sync-status", response_model=SyncStatusResponse)
def obter_status_sync(
    cliente_id: int,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """Endpoint para consultar status de sincronizacao"""
    try:
        cliente = db.query(Cliente).filter(
            Cliente.id == cliente_id,
            Cliente.usuario_id == usuario.id
        ).first()
        if not cliente:
            raise HTTPException(404, "Cliente nao encontrado")
        return SyncStatusResponse(
            cliente_id=cliente.id,
            status=cliente.status_sync or "PENDENTE",
            ultimo_sync=cliente.ultimo_sync,
            mensagem=cliente.mensagem_sync
        )
    except SQLAlchemyError as e:
        raise HTTPException(500, f"Erro ao consultar banco de dados: {str(e)}")


@app.get("/empresas/{cliente_id}/ucs")
def listar_ucs_cliente(
    cliente_id: int,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    try:
        cliente = db.query(Cliente).filter(
            Cliente.id == cliente_id,
            Cliente.usuario_id == usuario.id
        ).first()
        if not cliente:
            raise HTTPException(404, "Cliente nao encontrado")

        # Retorna as UCs com o CPF da empresa para comparação
        ucs_com_proprietario = []
        for uc in cliente.unidades:
            uc_dict = {
                "id": uc.id,
                "cdc": uc.cdc,
                "digito_verificador": uc.digito_verificador,
                "empresa_web": uc.empresa_web,
                "nome_titular": uc.nome_titular,
                "endereco": uc.endereco,
                "numero_imovel": uc.numero_imovel,
                "complemento": uc.complemento,
                "bairro": uc.bairro,
                "nome_municipio": uc.nome_municipio,
                "uf": uc.uf,
                "uc_ativa": uc.uc_ativa,
                "contrato_ativo": uc.contrato_ativo,
                # Adiciona o CPF da empresa para comparação
                "cpf_empresa": cliente.responsavel_cpf,
                # Adiciona o cpfCnpj da UC (campo que agora existe)
                "cpf_cnpj_uc": uc.cpf_cnpj
            }
            ucs_com_proprietario.append(uc_dict)

        return ucs_com_proprietario
    except SQLAlchemyError as e:
        raise HTTPException(500, f"Erro ao consultar banco de dados: {str(e)}")


@app.get("/empresas/{cliente_id}/usinas")
def listar_usinas_arvore(
    cliente_id: int,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    try:
        # Primeiro verifica se o cliente pertence ao usuario
        cliente = db.query(Cliente).filter(
            Cliente.id == cliente_id,
            Cliente.usuario_id == usuario.id
        ).first()
        if not cliente:
            raise HTTPException(404, "Cliente nao encontrado")

        usinas = db.query(UnidadeConsumidora).filter(
            UnidadeConsumidora.cliente_id == cliente_id,
            UnidadeConsumidora.is_geradora == True
        ).options(joinedload(UnidadeConsumidora.beneficiarias)).all()
        return usinas
    except SQLAlchemyError as e:
        raise HTTPException(500, f"Erro ao consultar banco de dados: {str(e)}")


@app.get("/usinas/{usina_id}/gd-details")
def obter_detalhes_gd(
    usina_id: int,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """
    Obtém detalhes completos de Geração Distribuída de uma usina.
    Retorna histórico mensal de produção, transferências, saldo e composição.
    """
    try:
        # 1. Verifica se a usina existe e pertence ao usuário
        usina = db.query(UnidadeConsumidora).join(Cliente).filter(
            UnidadeConsumidora.id == usina_id,
            UnidadeConsumidora.is_geradora == True,
            Cliente.usuario_id == usuario.id
        ).first()

        if not usina:
            raise HTTPException(404, "Usina não encontrada ou acesso negado")

        # 2. Obtém o cliente para pegar o CPF
        cliente = usina.cliente

        # 3. Busca dados detalhados do Gateway
        gd_details = gateway.get_gd_details(cliente.responsavel_cpf, {
            "cdc": usina.cdc,
            "empresa_web": usina.empresa_web,
            "digito_verificador": usina.digito_verificador
        })

        if not gd_details:
            # Se não conseguir do gateway, retorna dados básicos do banco
            return {
                "usina": {
                    "id": usina.id,
                    "codigo_uc": usina.codigo_uc,
                    "cdc": usina.cdc,
                    "endereco": usina.endereco,
                    "saldo_atual": usina.saldo_acumulado,
                    "tipo_geracao": usina.tipo_geracao
                },
                "historico_mensal": [],
                "fonte": "banco_local"
            }

        # 4. Processa e retorna os dados
        infos = gd_details.get("infos", [])

        # Ordena por ano/mês decrescente
        if isinstance(infos, list):
            infos_ordenadas = sorted(
                infos,
                key=lambda x: (x.get('anoReferencia', 0), x.get('mesReferencia', 0)),
                reverse=True
            )
        else:
            infos_ordenadas = []

        return {
            "usina": {
                "id": usina.id,
                "codigo_uc": usina.codigo_uc,
                "cdc": usina.cdc,
                "endereco": usina.endereco,
                "saldo_atual": usina.saldo_acumulado,
                "tipo_geracao": usina.tipo_geracao,
                "empresa_nome": cliente.nome_empresa
            },
            "historico_mensal": infos_ordenadas,
            "fonte": "gateway"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Erro ao buscar detalhes GD: {e}")
        raise HTTPException(500, f"Erro ao buscar detalhes: {str(e)}")


@app.get("/ucs/{uc_id}/faturas")
def listar_faturas_uc(
    uc_id: int,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    try:
        # Verifica se a UC pertence a um cliente do usuario
        uc = db.query(UnidadeConsumidora).join(Cliente).filter(
            UnidadeConsumidora.id == uc_id,
            Cliente.usuario_id == usuario.id
        ).first()
        if not uc:
            raise HTTPException(404, "Unidade Consumidora nao encontrada")
        return db.query(Fatura).filter(Fatura.uc_id == uc_id).order_by(Fatura.ano.desc(), Fatura.mes.desc()).all()
    except SQLAlchemyError as e:
        raise HTTPException(500, f"Erro ao consultar banco de dados: {str(e)}")


@app.get("/faturas/{fatura_id}/detalhes")
def ver_detalhes_fatura(
    fatura_id: int,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    try:
        # Verifica se a fatura pertence a um cliente do usuario
        fatura = db.query(Fatura).join(UnidadeConsumidora).join(Cliente).filter(
            Fatura.id == fatura_id,
            Cliente.usuario_id == usuario.id
        ).first()
        if not fatura:
            raise HTTPException(404, "Fatura nao encontrada")
        return fatura
    except SQLAlchemyError as e:
        raise HTTPException(500, f"Erro ao consultar banco de dados: {str(e)}")


# ==========================================
# 2. ROTAS DE ACAO (PROTEGIDAS)
# ==========================================

@app.post("/empresas/novo", response_model=MensagemResponse)
def registrar_empresa(
    nome: str,
    cpf: str,
    telefone_final: str,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """Registrar nova empresa vinculada ao usuario logado"""
    try:
        # Valida dados usando Pydantic
        dados = ClienteCreate(nome=nome, cpf=cpf, telefone_final=telefone_final)

        # Verifica se CPF ja existe para este usuario
        existente = db.query(Cliente).filter(
            Cliente.responsavel_cpf == dados.cpf,
            Cliente.usuario_id == usuario.id
        ).first()
        if existente:
            raise HTTPException(400, "CPF ja cadastrado para sua conta")

        cliente = Cliente(
            usuario_id=usuario.id,  # Vincula ao usuario logado
            nome_empresa=dados.nome,
            responsavel_cpf=dados.cpf,
            telefone_login=dados.telefone_final,
            ultimo_login=datetime.now(),
            status_sync="PENDENTE"
        )
        db.add(cliente)
        db.commit()
        db.refresh(cliente)
        return MensagemResponse(msg="Empresa cadastrada com sucesso", id=cliente.id)
    except ValidationError as e:
        raise HTTPException(422, f"Dados invalidos: {e.errors()[0]['msg']}")
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(500, f"Erro ao salvar no banco: {str(e)}")


@app.post("/empresas/{id}/conectar")
def iniciar_conexao_energisa(
    id: int,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """
    Inicia o processo de conexão com a Energisa.
    Retorna a lista de telefones disponíveis para o usuário escolher.
    """
    cliente = db.query(Cliente).filter(
        Cliente.id == id,
        Cliente.usuario_id == usuario.id
    ).first()
    if not cliente:
        raise HTTPException(404, "Cliente nao encontrado")

    try:
        print(f"\n{'='*60}")
        print(f"[CONECTAR] Iniciando conexao para {cliente.nome_empresa}...")
        print(f"CPF: {cliente.responsavel_cpf}")
        print(f"{'='*60}")

        # Usa o endpoint público que retorna lista de telefones
        resp = gateway.iniciar_simulacao(cliente.responsavel_cpf)

        print(f"Resposta do gateway:")
        print(f"  - Transaction ID: {resp.get('transaction_id')}")
        print(f"  - Lista Telefone: {resp.get('listaTelefone', [])}")
        print(f"{'='*60}\n")

        cliente.transaction_id = resp.get("transaction_id")
        cliente.status_conexao = "AGUARDANDO_TELEFONE"
        db.commit()

        return {
            "msg": "Telefones carregados",
            "transaction_id": cliente.transaction_id,
            "listaTelefone": resp.get("listaTelefone", [])
        }

    except Exception as e:
        print(f"❌ Erro ao iniciar conexao: {e}")
        raise HTTPException(500, f"Erro ao carregar telefones: {str(e)}")


@app.post("/empresas/{id}/enviar-sms")
def enviar_sms_telefone(
    id: int,
    telefone: str = Query(...),
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """
    Envia o SMS para o telefone selecionado pelo usuário.
    """
    cliente = db.query(Cliente).filter(
        Cliente.id == id,
        Cliente.usuario_id == usuario.id
    ).first()
    if not cliente:
        raise HTTPException(404, "Cliente nao encontrado")

    if not cliente.transaction_id:
        raise HTTPException(400, "Nenhuma transacao ativa. Inicie a conexao primeiro.")

    try:
        print(f"\n{'='*60}")
        print(f"[ENVIAR SMS] Cliente: {cliente.nome_empresa}")
        print(f"[ENVIAR SMS] Transaction ID: {cliente.transaction_id}")
        print(f"[ENVIAR SMS] Telefone selecionado: {telefone}")
        print(f"{'='*60}")

        # Envia o SMS para o telefone escolhido
        resp = gateway.enviar_sms_simulacao(cliente.transaction_id, telefone)

        print(f"✅ SMS enviado com sucesso!")
        print(f"Resposta: {resp}")
        print(f"{'='*60}\n")

        cliente.status_conexao = "AGUARDANDO_SMS"
        db.commit()

        return {"msg": "SMS enviado com sucesso", "success": True}

    except Exception as e:
        print(f"❌ Erro ao enviar SMS: {e}")
        raise HTTPException(500, f"Erro ao enviar SMS: {str(e)}")


@app.post("/empresas/{id}/validar-sms")
def validar_sms(
    id: int,
    codigo_sms: str,
    background_tasks: BackgroundTasks,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """
    Valida o código SMS e completa a conexão com a Energisa.
    Após validar, inicia a sincronização dos dados.
    """
    cliente = db.query(Cliente).filter(
        Cliente.id == id,
        Cliente.usuario_id == usuario.id
    ).first()
    if not cliente:
        raise HTTPException(404, "Cliente nao encontrado")

    if not cliente.transaction_id:
        raise HTTPException(400, "Nenhuma transacao ativa.")

    try:
        print(f"Validando SMS para cliente {cliente.nome_empresa}...")

        # Valida o SMS usando o endpoint público
        resp = gateway.validar_sms_simulacao(cliente.transaction_id, codigo_sms)

        if resp.get("success"):
            cliente.status_conexao = "CONECTADO"
            cliente.ultimo_login = datetime.now()
            db.commit()

            # Inicia a sincronização dos dados em background
            background_tasks.add_task(sincronizar_dados_cliente, cliente.id)

            return {"msg": "Conectado com sucesso!", "success": True}
        else:
            raise HTTPException(400, "Falha ao validar SMS")

    except HTTPException:
        raise
    except Exception as e:
        print(f"Erro ao validar SMS: {e}")
        raise HTTPException(400, f"Falha ao validar SMS: {str(e)}")


@app.get("/faturas/{id}/download")
def baixar_pdf_fatura(
    id: int,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    # Verifica se a fatura pertence ao usuario
    fatura = db.query(Fatura).join(UnidadeConsumidora).join(Cliente).filter(
        Fatura.id == id,
        Cliente.usuario_id == usuario.id
    ).first()
    if not fatura:
        raise HTTPException(404, "Fatura nao encontrada")

    pasta_storage = "faturas_storage"
    os.makedirs(pasta_storage, exist_ok=True)
    filename_local = f"{pasta_storage}/fatura_{fatura.uc.cdc}_{fatura.mes}-{fatura.ano}.pdf"

    if not os.path.exists(filename_local):
        print(f"Baixando PDF da Energisa para Fatura {id}...")
        try:
            cli = fatura.uc.cliente
            res = gateway.download_fatura(
                cli.responsavel_cpf,
                {
                    "cdc": fatura.uc.cdc,
                    "empresa_web": fatura.uc.empresa_web,
                    "digito_verificador": fatura.uc.digito_verificador
                },
                {
                    "mes": fatura.mes,
                    "ano": fatura.ano,
                    "numero_fatura": fatura.numero_fatura
                }
            )
            if res and "file_base64" in res:
                with open(filename_local, "wb") as f:
                    f.write(base64.b64decode(res["file_base64"]))
                fatura.arquivo_pdf_path = filename_local
                db.commit()
                print(f"PDF salvo: {filename_local}")
            else:
                raise Exception("Gateway nao retornou o arquivo.")
        except Exception as e:
            print(f"Erro download: {e}")
            raise HTTPException(500, f"Erro ao baixar PDF: {str(e)}")

    try:
        with open(filename_local, "rb") as f:
            content = f.read()
            b64_string = base64.b64encode(content).decode('utf-8')
        return {
            "filename": f"Fatura_{fatura.uc.cdc}_{fatura.mes}-{fatura.ano}.pdf",
            "content_type": "application/pdf",
            "file_base64": b64_string
        }
    except Exception as e:
        raise HTTPException(500, f"Erro ao ler arquivo: {e}")


# ==========================================
# 3. CORE: ROBO DE SINCRONIZACAO
# ==========================================

def sincronizar_dados_cliente(cliente_id: int):
    db = SessionLocal()
    try:
        cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
        if not cliente:
            return

        # Atualiza status para SINCRONIZANDO
        cliente.status_sync = "SINCRONIZANDO"
        cliente.mensagem_sync = "Buscando dados da Energisa..."
        db.commit()

        print(f"ROBO: Sincronizando {cliente.nome_empresa} (CPF {cliente.responsavel_cpf})...")

        ucs_remotas = gateway.list_ucs(cliente.responsavel_cpf)

        if isinstance(ucs_remotas, dict) and "detail" in ucs_remotas:
            print(f"Erro ao buscar UCs: {ucs_remotas['detail']}")
            cliente.status_sync = "ERRO"
            cliente.mensagem_sync = f"Erro: {ucs_remotas['detail']}"
            db.commit()
            return

        print(f"   Encontradas {len(ucs_remotas)} UCs.")

        for uc_data in ucs_remotas:
            # 1. TRATAMENTO DE DADOS BASICOS
            raw_end = uc_data.get('endereco')
            endereco_final = raw_end.get('descricao', "") if isinstance(raw_end, dict) else str(raw_end) if raw_end else "Endereco nao informado"

            cdc_real = uc_data.get('cdc') or uc_data.get('numeroUc')
            digito_real = uc_data.get('digitoVerificador')
            if digito_real is None:
                digito_real = uc_data.get('digitoVerificadorCdc')
            if digito_real is None:
                digito_real = 0

            # 2. Variaveis Solares (INICIALIZACAO SEGURA)
            gd_code = uc_data.get('geracaoDistribuida')
            eh_geradora = False
            saldo_kwh = 0.0
            tipo_geracao = None
            lista_beneficiarias = []

            # 3. Busca Dados Solares
            if gd_code and str(gd_code) == str(uc_data.get('numeroUc')):
                eh_geradora = True
                print(f"   UC {cdc_real} e USINA! Buscando detalhes...")

                try:
                    gd_info = gateway.get_gd_info(cliente.responsavel_cpf, {
                        "cdc": cdc_real,
                        "empresa_web": uc_data.get('codigoEmpresaWeb', 6),
                        "digitoVerificadorCdc": digito_real
                    })

                    if gd_info and 'infos' in gd_info:
                        obj_gd = gd_info['infos'].get('objeto', {}) or {}
                        saldo_kwh = obj_gd.get('qtdKwhSaldo', 0)
                        tipo_geracao = obj_gd.get('tipoGeracao', 'Solar')
                        lista_beneficiarias = obj_gd.get('listaBeneficiarias') or []
                        print(f"      {len(lista_beneficiarias)} beneficiarias encontradas.")

                except Exception as e:
                    print(f"      Erro dados GD (mas vamos continuar): {e}")

            # 3.5. Buscar CPF/CNPJ da UC (informação detalhada)
            cpf_cnpj_uc = None
            try:
                uc_info = gateway.get_uc_info(cliente.responsavel_cpf, {
                    "cdc": cdc_real,
                    "empresa_web": uc_data.get('codigoEmpresaWeb', 6),
                    "digitoVerificadorCdc": digito_real
                })
                if uc_info and 'infos' in uc_info:
                    dados_uc = uc_info['infos'].get('dadosUc', {})
                    cpf_cnpj_uc = str(dados_uc.get('cpfCnpj', ''))
                    print(f"      CPF/CNPJ da UC {cdc_real}: {cpf_cnpj_uc}")
            except Exception as e:
                print(f"      Erro ao buscar CPF/CNPJ da UC (continuando): {e}")

            # 4. Salvar UC Principal (USINA ou NORMAL)
            uc_local = db.query(UnidadeConsumidora).filter_by(
                cliente_id=cliente.id,
                codigo_uc=uc_data['numeroUc']
            ).first()

            if not uc_local:
                uc_local = UnidadeConsumidora(
                    cliente_id=cliente.id,
                    codigo_uc=uc_data.get('numeroUc'),
                    cdc=cdc_real,
                    digito_verificador=digito_real,
                    empresa_web=uc_data.get('codigoEmpresaWeb', 6),
                    cpf_cnpj=cpf_cnpj_uc,
                    endereco=endereco_final,
                    nome_titular=uc_data.get('nomeTitular'),
                    numero_imovel=uc_data.get('numeroImovel'),
                    complemento=uc_data.get('complemento'),
                    bairro=uc_data.get('bairro'),
                    nome_municipio=uc_data.get('nomeMunicipio'),
                    uf=uc_data.get('uf'),
                    uc_ativa=uc_data.get('ucAtiva'),
                    uc_cortada=uc_data.get('ucCortada'),
                    uc_desligada=uc_data.get('ucDesligada'),
                    contrato_ativo=uc_data.get('contratoAtivo'),
                    is_geradora=eh_geradora,
                    saldo_acumulado=saldo_kwh,
                    tipo_geracao=tipo_geracao
                )
                db.add(uc_local)
            else:
                uc_local.cpf_cnpj = cpf_cnpj_uc
                uc_local.endereco = endereco_final
                uc_local.nome_titular = uc_data.get('nomeTitular')
                uc_local.numero_imovel = uc_data.get('numeroImovel')
                uc_local.complemento = uc_data.get('complemento')
                uc_local.bairro = uc_data.get('bairro')
                uc_local.nome_municipio = uc_data.get('nomeMunicipio')
                uc_local.uf = uc_data.get('uf')
                uc_local.uc_ativa = uc_data.get('ucAtiva')
                uc_local.uc_cortada = uc_data.get('ucCortada')
                uc_local.uc_desligada = uc_data.get('ucDesligada')
                uc_local.contrato_ativo = uc_data.get('contratoAtivo')
                uc_local.is_geradora = eh_geradora
                uc_local.saldo_acumulado = saldo_kwh
                uc_local.tipo_geracao = tipo_geracao

            db.commit()
            db.refresh(uc_local)
            print(f"   UC {uc_local.codigo_uc} salva.")

            # 5. Salvar Beneficiarias
            if lista_beneficiarias:
                for ben in lista_beneficiarias:
                    ben_cdc = ben.get('cdc')
                    uc_filha = db.query(UnidadeConsumidora).filter_by(
                        cliente_id=cliente.id,
                        cdc=ben_cdc
                    ).first()

                    if not uc_filha:
                        uc_filha = UnidadeConsumidora(
                            cliente_id=cliente.id,
                            codigo_uc=ben_cdc,
                            cdc=ben_cdc,
                            digito_verificador=ben.get('digitoVerificador', 0),
                            empresa_web=ben.get('codigoEmpresaWeb', 6),
                            endereco=ben.get('endereco', 'Endereco Beneficiaria'),
                            nome_titular=ben.get('nome'),
                            numero_imovel=ben.get('numeroImovel'),
                            complemento=ben.get('complemento'),
                            bairro=ben.get('bairro'),
                            nome_municipio=ben.get('nomeMunicipio'),
                            uf=ben.get('uf'),
                            uc_ativa=ben.get('ucAtiva'),
                            uc_cortada=ben.get('ucCortada'),
                            uc_desligada=ben.get('ucDesligada'),
                            contrato_ativo=ben.get('contratoAtivo'),
                            is_geradora=False
                        )
                        db.add(uc_filha)
                    else:
                        # Atualiza dados da beneficiária se já existe
                        uc_filha.endereco = ben.get('endereco', uc_filha.endereco)
                        uc_filha.nome_titular = ben.get('nome', uc_filha.nome_titular)
                        uc_filha.numero_imovel = ben.get('numeroImovel')
                        uc_filha.complemento = ben.get('complemento')
                        uc_filha.bairro = ben.get('bairro')
                        uc_filha.nome_municipio = ben.get('nomeMunicipio')
                        uc_filha.uf = ben.get('uf')
                        uc_filha.uc_ativa = ben.get('ucAtiva')
                        uc_filha.uc_cortada = ben.get('ucCortada')
                        uc_filha.uc_desligada = ben.get('ucDesligada')
                        uc_filha.contrato_ativo = ben.get('contratoAtivo')

                    # VINCULA AO PAI
                    uc_filha.geradora_id = uc_local.id
                    uc_filha.percentual_rateio = ben.get('percentualRecebido', 0)

                db.commit()
                print(f"      {len(lista_beneficiarias)} beneficiarias vinculadas a usina.")

            # --- 6. Baixar Faturas ---
            print(f"   Buscando faturas da UC {uc_local.cdc}...")
            try:
                faturas_remotas = gateway.list_faturas(cliente.responsavel_cpf, {
                    "cdc": uc_local.cdc,
                    "empresa_web": uc_local.empresa_web,
                    "digito_verificador": uc_local.digito_verificador
                })

                if isinstance(faturas_remotas, list):
                    count_novas = 0
                    for fat in faturas_remotas:
                        if not db.query(Fatura).filter_by(uc_id=uc_local.id, numero_fatura=fat.get('numeroFatura')).first():

                            dt_venc = None
                            if fat.get('dataVencimentoISO'):
                                try:
                                    dt_venc = datetime.fromisoformat(fat.get('dataVencimentoISO')).date()
                                except:
                                    pass

                            dt_leit = None
                            if fat.get('dataLeituraISO'):
                                try:
                                    dt_leit = datetime.fromisoformat(fat.get('dataLeituraISO')).date()
                                except:
                                    pass

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
                                codigo_barras=fat.get('codigoBarraFaturaLis') or fat.get('codigoBarra'),
                                pix_copia_cola=fat.get('qrCodePix'),
                                detalhes_json=json.dumps(fat.get('detalhamentoFatura', {}))
                            )
                            db.add(nova_fatura)
                            count_novas += 1
                    db.commit()
                    print(f"      {count_novas} novas faturas.")
                else:
                    print("      Resposta de faturas invalida (provavel erro 500 no Gateway).")

            except Exception as e:
                print(f"      Erro faturas: {e}")

        # Sincronizacao concluida com sucesso
        cliente.status_sync = "CONCLUIDO"
        cliente.ultimo_sync = datetime.now()
        cliente.mensagem_sync = f"Sincronizado com sucesso. {len(ucs_remotas)} UCs processadas."
        db.commit()
        print(f"Sincronizacao concluida para {cliente.nome_empresa}")

    except Exception as e:
        print(f"Erro Critico Sync: {e}")
        traceback.print_exc()
        # Atualiza status de erro
        try:
            cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
            if cliente:
                cliente.status_sync = "ERRO"
                cliente.mensagem_sync = f"Erro na sincronizacao: {str(e)[:200]}"
                db.commit()
        except:
            pass
    finally:
        db.close()


# ==========================================
# 4. ROTAS DE GESTORES DE UC
# ==========================================

@app.post("/gestores/solicitar", response_model=SolicitacaoGestorResponse)
def solicitar_gestor(
    req: SolicitarGestorRequest,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """
    Solicita adicao de gestor a uma UC.
    - Se is_proprietario=True: Chama o gateway direto para adicionar (status PENDENTE -> CONCLUIDA)
    - Se is_proprietario=False: Cria solicitacao aguardando codigo (status AGUARDANDO_CODIGO)
    """
    print(f"\n{'#'*70}")
    print(f"[GESTOR] Endpoint /gestores/solicitar CHAMADO")
    print(f"Request: {req.model_dump()}")
    print(f"Usuario: {usuario.email}")
    print(f"is_proprietario: {req.is_proprietario}")
    print(f"{'#'*70}\n")

    try:
        # Verifica se o cliente pertence ao usuario
        cliente = db.query(Cliente).filter(
            Cliente.id == req.cliente_id,
            Cliente.usuario_id == usuario.id
        ).first()
        if not cliente:
            raise HTTPException(404, "Cliente nao encontrado")

        # Busca a UC se informada
        uc = None
        if req.uc_id:
            uc = db.query(UnidadeConsumidora).filter(
                UnidadeConsumidora.id == req.uc_id,
                UnidadeConsumidora.cliente_id == cliente.id
            ).first()

        # Cria a solicitacao (sempre PENDENTE inicialmente)
        solicitacao = SolicitacaoGestor(
            usuario_id=usuario.id,
            cliente_id=cliente.id,
            uc_id=req.uc_id,
            cdc=req.cdc,
            digito_verificador=req.digito_verificador,
            empresa_web=req.empresa_web,
            cpf_gestor=req.cpf_gestor,
            nome_gestor=req.nome_gestor,
            status="PENDENTE",
            expira_em=datetime.utcnow() + timedelta(days=5)  # Sempre 5 dias
        )
        db.add(solicitacao)
        db.commit()
        db.refresh(solicitacao)

        # SEMPRE chama o gateway para adicionar gerente (tanto proprietario quanto nao-proprietario)
        try:
            payload_gateway = {
                "codigoEmpresaWeb": req.empresa_web,
                "cdc": req.cdc,
                "digitoVerificador": req.digito_verificador,
                "numeroCpfCnpjCliente": req.cpf_gestor
            }
            print(f"\n{'='*60}")
            print(f"ADICIONAR GERENTE - Enviando para Gateway")
            print(f"{'='*60}")
            print(f"CPF Sessao: {cliente.responsavel_cpf}")
            print(f"CPF Gestor: {req.cpf_gestor}")
            print(f"Is Proprietario: {req.is_proprietario}")
            print(f"Payload: {payload_gateway}")
            print(f"{'='*60}\n")

            resultado = gateway.adicionar_gerente(
                cliente.responsavel_cpf,
                payload_gateway
            )

            print(f"Resultado do Gateway: {resultado}\n")

            # Se for proprietario e deu sucesso, marca como CONCLUIDA
            if req.is_proprietario and resultado.get('status') == 'success':
                solicitacao.status = "CONCLUIDA"
                solicitacao.concluido_em = datetime.utcnow()
                solicitacao.mensagem = "Gestor adicionado com sucesso"
                db.commit()

                # Dispara sincronizacao automatica para atualizar as UCs
                print(f"[GESTOR] Gestor adicionado com sucesso! Disparando sincronizacao do cliente {cliente.id}...")
                try:
                    from threading import Thread
                    sync_thread = Thread(target=sincronizar_dados_cliente, args=(cliente.id,), daemon=True)
                    sync_thread.start()
                    print(f"[GESTOR] Sincronizacao iniciada em background")
                except Exception as sync_error:
                    print(f"[GESTOR] Aviso: Erro ao iniciar sincronizacao: {sync_error}")

            else:
                # Nao e proprietario OU deu algum erro - fica AGUARDANDO_CODIGO
                solicitacao.status = "AGUARDANDO_CODIGO"
                solicitacao.mensagem = "Solicitacao criada na Energisa. Aguardando codigo do proprietario."
                db.commit()

        except Exception as e:
            print(f"ERRO ao chamar gateway: {str(e)}\n")
            solicitacao.status = "ERRO"
            solicitacao.mensagem = str(e)[:200]
            db.commit()
            raise HTTPException(500, f"Erro ao solicitar acesso: {str(e)}")

        # Prepara resposta
        return SolicitacaoGestorResponse(
            id=solicitacao.id,
            cliente_id=solicitacao.cliente_id,
            uc_id=solicitacao.uc_id,
            cdc=solicitacao.cdc,
            digito_verificador=solicitacao.digito_verificador,
            empresa_web=solicitacao.empresa_web,
            cpf_gestor=solicitacao.cpf_gestor,
            nome_gestor=solicitacao.nome_gestor,
            status=solicitacao.status,
            criado_em=solicitacao.criado_em,
            expira_em=solicitacao.expira_em,
            concluido_em=solicitacao.concluido_em,
            mensagem=solicitacao.mensagem,
            endereco_uc=uc.endereco if uc else None,
            nome_empresa=cliente.nome_empresa
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Erro ao criar solicitacao: {str(e)}")


@app.get("/gestores/pendentes", response_model=List[SolicitacaoGestorResponse])
def listar_solicitacoes_pendentes(
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """Lista todas as solicitacoes pendentes do usuario (AGUARDANDO_CODIGO)"""
    try:
        # Atualiza status de expiradas
        db.query(SolicitacaoGestor).filter(
            SolicitacaoGestor.usuario_id == usuario.id,
            SolicitacaoGestor.status == "AGUARDANDO_CODIGO",
            SolicitacaoGestor.expira_em < datetime.utcnow()
        ).update({"status": "EXPIRADA"})
        db.commit()

        # Busca pendentes E concluidas (últimas 30 dias)
        trinta_dias_atras = datetime.utcnow() - timedelta(days=30)

        solicitacoes = db.query(SolicitacaoGestor).filter(
            SolicitacaoGestor.usuario_id == usuario.id,
            or_(
                SolicitacaoGestor.status.in_(["AGUARDANDO_CODIGO", "PENDENTE"]),
                and_(
                    SolicitacaoGestor.status == "CONCLUIDA",
                    SolicitacaoGestor.concluido_em >= trinta_dias_atras
                )
            )
        ).order_by(SolicitacaoGestor.criado_em.desc()).all()

        resultado = []
        for sol in solicitacoes:
            cliente = db.query(Cliente).filter(Cliente.id == sol.cliente_id).first()
            uc = db.query(UnidadeConsumidora).filter(UnidadeConsumidora.id == sol.uc_id).first() if sol.uc_id else None

            resultado.append(SolicitacaoGestorResponse(
                id=sol.id,
                cliente_id=sol.cliente_id,
                uc_id=sol.uc_id,
                cdc=sol.cdc,
                digito_verificador=sol.digito_verificador,
                empresa_web=sol.empresa_web,
                cpf_gestor=sol.cpf_gestor,
                nome_gestor=sol.nome_gestor,
                status=sol.status,
                criado_em=sol.criado_em,
                expira_em=sol.expira_em,
                concluido_em=sol.concluido_em,
                mensagem=sol.mensagem,
                endereco_uc=uc.endereco if uc else None,
                nome_empresa=cliente.nome_empresa if cliente else None
            ))

        return resultado

    except Exception as e:
        raise HTTPException(500, f"Erro ao listar solicitacoes: {str(e)}")


@app.post("/gestores/validar-codigo", response_model=SolicitacaoGestorResponse)
def validar_codigo_gestor(
    req: ValidarCodigoGestorRequest,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """Valida codigo de autorizacao e finaliza a solicitacao de gestor"""
    try:
        # Busca a solicitacao
        solicitacao = db.query(SolicitacaoGestor).filter(
            SolicitacaoGestor.id == req.solicitacao_id,
            SolicitacaoGestor.usuario_id == usuario.id
        ).first()

        if not solicitacao:
            raise HTTPException(404, "Solicitacao nao encontrada")

        if solicitacao.status != "AGUARDANDO_CODIGO":
            raise HTTPException(400, f"Solicitacao nao esta aguardando codigo (status: {solicitacao.status})")

        if solicitacao.expira_em and solicitacao.expira_em < datetime.utcnow():
            solicitacao.status = "EXPIRADA"
            db.commit()
            raise HTTPException(400, "Solicitacao expirada")

        # Busca o cliente para obter CPF
        cliente = db.query(Cliente).filter(Cliente.id == solicitacao.cliente_id).first()
        if not cliente:
            raise HTTPException(404, "Cliente nao encontrado")

        # Chama o gateway para validar o codigo
        try:
            payload_gateway = {
                "codigoEmpresaWeb": solicitacao.empresa_web,
                "unidadeConsumidora": solicitacao.cdc,
                "codigo": int(req.codigo)
            }
            print(f"\n{'='*60}")
            print(f"VALIDAR CODIGO - Enviando para Gateway")
            print(f"{'='*60}")
            print(f"CPF Sessao: {cliente.responsavel_cpf}")
            print(f"Payload: {payload_gateway}")
            print(f"{'='*60}\n")

            resultado = gateway.autorizacao_pendente(
                cliente.responsavel_cpf,
                payload_gateway
            )

            solicitacao.status = "CONCLUIDA"
            solicitacao.concluido_em = datetime.utcnow()
            solicitacao.codigo_autorizacao = req.codigo
            solicitacao.mensagem = "Autorizacao validada com sucesso"
            db.commit()

            # Dispara sincronizacao automatica para buscar a nova UC
            print(f"[GESTOR] Codigo validado! Disparando sincronizacao do cliente {cliente.id}...")
            try:
                from threading import Thread
                sync_thread = Thread(target=sincronizar_dados_cliente, args=(cliente.id,), daemon=True)
                sync_thread.start()
                print(f"[GESTOR] Sincronizacao iniciada em background")
            except Exception as sync_error:
                print(f"[GESTOR] Aviso: Erro ao iniciar sincronizacao: {sync_error}")
                # Nao falha a validacao por causa disso

        except Exception as e:
            solicitacao.mensagem = f"Erro na validacao: {str(e)[:100]}"
            db.commit()
            raise HTTPException(400, f"Erro ao validar codigo: {str(e)}")

        # Busca dados para resposta
        uc = db.query(UnidadeConsumidora).filter(UnidadeConsumidora.id == solicitacao.uc_id).first() if solicitacao.uc_id else None

        return SolicitacaoGestorResponse(
            id=solicitacao.id,
            cliente_id=solicitacao.cliente_id,
            uc_id=solicitacao.uc_id,
            cdc=solicitacao.cdc,
            digito_verificador=solicitacao.digito_verificador,
            empresa_web=solicitacao.empresa_web,
            cpf_gestor=solicitacao.cpf_gestor,
            nome_gestor=solicitacao.nome_gestor,
            status=solicitacao.status,
            criado_em=solicitacao.criado_em,
            expira_em=solicitacao.expira_em,
            concluido_em=solicitacao.concluido_em,
            mensagem=solicitacao.mensagem,
            endereco_uc=uc.endereco if uc else None,
            nome_empresa=cliente.nome_empresa
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Erro ao validar codigo: {str(e)}")


@app.delete("/gestores/pendentes/{solicitacao_id}")
def cancelar_solicitacao(
    solicitacao_id: int,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """Cancela uma solicitacao pendente"""
    try:
        solicitacao = db.query(SolicitacaoGestor).filter(
            SolicitacaoGestor.id == solicitacao_id,
            SolicitacaoGestor.usuario_id == usuario.id
        ).first()

        if not solicitacao:
            raise HTTPException(404, "Solicitacao nao encontrada")

        if solicitacao.status not in ["AGUARDANDO_CODIGO", "PENDENTE"]:
            raise HTTPException(400, "Apenas solicitacoes pendentes podem ser canceladas")

        solicitacao.status = "CANCELADA"
        db.commit()

        return {"msg": "Solicitacao cancelada com sucesso"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Erro ao cancelar solicitacao: {str(e)}")


# ==========================================
# ROTAS PÚBLICAS DE LEADS (SEM AUTENTICAÇÃO)
# ==========================================

@app.post("/public/leads/salvar")
def salvar_lead_publico(
    cpf: str,
    nome: Optional[str] = None,
    telefone: Optional[str] = None,
    email: Optional[str] = None,
    total_ucs: int = 0,
    total_consumo_kwh: int = 0,
    valor_total_faturas: float = 0.0,
    dados_simulacao_json: Optional[str] = None,
    ip_origem: Optional[str] = None,
    user_agent: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Endpoint PÚBLICO para salvar leads vindos da landing page.
    Não requer autenticação - é chamado pelo gateway.
    """
    try:
        # Remove formatação do CPF
        cpf_limpo = cpf.replace(".", "").replace("-", "")

        # Verifica se já existe lead com esse CPF nos ultimos 7 dias
        sete_dias_atras = datetime.utcnow() - timedelta(days=7)

        lead_existente = db.query(Lead).filter(
            Lead.cpf == cpf_limpo,
            Lead.criado_em >= sete_dias_atras
        ).first()

        if lead_existente:
            # Atualiza o lead existente
            lead_existente.nome = nome or lead_existente.nome
            lead_existente.telefone = telefone or lead_existente.telefone
            lead_existente.email = email or lead_existente.email
            lead_existente.total_ucs = total_ucs
            lead_existente.total_consumo_kwh = total_consumo_kwh
            lead_existente.valor_total_faturas = valor_total_faturas
            lead_existente.dados_simulacao_json = dados_simulacao_json
            lead_existente.atualizado_em = datetime.utcnow()

            db.commit()
            db.refresh(lead_existente)

            return {
                "success": True,
                "message": "Lead atualizado com sucesso",
                "lead_id": lead_existente.id,
                "is_new": False
            }

        # Cria novo lead
        novo_lead = Lead(
            cpf=cpf_limpo,
            nome=nome,
            telefone=telefone,
            email=email,
            total_ucs=total_ucs,
            total_consumo_kwh=total_consumo_kwh,
            valor_total_faturas=valor_total_faturas,
            dados_simulacao_json=dados_simulacao_json,
            status="NOVO",
            origem="LANDING_PAGE",
            ip_origem=ip_origem,
            user_agent=user_agent
        )

        db.add(novo_lead)
        db.commit()
        db.refresh(novo_lead)

        return {
            "success": True,
            "message": "Lead cadastrado com sucesso",
            "lead_id": novo_lead.id,
            "is_new": True
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Erro ao salvar lead: {str(e)}")


# ==========================================
# ROTAS DE LEADS (SUPER ADMIN)
# ==========================================

@app.get("/admin/leads", response_model=List[LeadResponse])
def listar_leads(
    status: str = None,
    skip: int = 0,
    limit: int = 100,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """
    Lista todos os leads com filtros opcionais.
    Requer permissão de SUPER ADMIN.
    """
    verificar_superadmin(usuario)

    try:
        query = db.query(Lead)

        # Filtro por status
        if status:
            query = query.filter(Lead.status == status)

        # Ordena por mais recentes primeiro
        query = query.order_by(Lead.criado_em.desc())

        # Paginacao
        leads = query.offset(skip).limit(limit).all()

        return leads

    except Exception as e:
        raise HTTPException(500, f"Erro ao listar leads: {str(e)}")


@app.get("/admin/leads/{lead_id}", response_model=LeadResponse)
def obter_lead(
    lead_id: int,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """
    Retorna detalhes de um lead especifico.
    Requer permissão de SUPER ADMIN.
    """
    verificar_superadmin(usuario)

    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()

        if not lead:
            raise HTTPException(404, "Lead nao encontrado")

        return lead

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Erro ao obter lead: {str(e)}")


@app.put("/admin/leads/{lead_id}", response_model=LeadResponse)
def atualizar_lead(
    lead_id: int,
    dados: LeadUpdate,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """
    Atualiza dados do lead (status, observacoes, atribuicao, etc).
    Requer permissão de SUPER ADMIN.
    """
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()

        if not lead:
            raise HTTPException(404, "Lead nao encontrado")

        # Guarda status anterior para criar interacao
        status_anterior = lead.status

        # Atualiza campos fornecidos
        if dados.nome is not None:
            lead.nome = dados.nome
        if dados.telefone is not None:
            lead.telefone = dados.telefone
        if dados.email is not None:
            lead.email = dados.email
        if dados.status is not None:
            lead.status = dados.status
            if dados.status == "CONVERTIDO":
                lead.convertido_em = datetime.utcnow()
        if dados.cliente_id is not None:
            lead.cliente_id = dados.cliente_id
        if dados.uc_geradora_id is not None:
            lead.uc_geradora_id = dados.uc_geradora_id
        if dados.observacoes is not None:
            lead.observacoes = dados.observacoes
        if dados.motivo_perda is not None:
            lead.motivo_perda = dados.motivo_perda

        lead.atualizado_em = datetime.utcnow()

        # Se mudou o status, cria uma interacao automatica
        if dados.status and dados.status != status_anterior:
            interacao = InteracaoLead(
                lead_id=lead.id,
                tipo="STATUS_CHANGE",
                titulo=f"Status alterado de {status_anterior} para {dados.status}",
                status_anterior=status_anterior,
                status_novo=dados.status,
                usuario_id=usuario.id
            )
            db.add(interacao)

        db.commit()
        db.refresh(lead)

        return lead

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Erro ao atualizar lead: {str(e)}")


@app.get("/admin/leads/{lead_id}/interacoes", response_model=List[InteracaoLeadResponse])
def listar_interacoes_lead(
    lead_id: int,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """
    Lista todas as interacoes de um lead (timeline do CRM).
    Requer permissão de SUPER ADMIN.
    """
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()

        if not lead:
            raise HTTPException(404, "Lead nao encontrado")

        interacoes = db.query(InteracaoLead).filter(
            InteracaoLead.lead_id == lead_id
        ).order_by(InteracaoLead.criado_em.desc()).all()

        return interacoes

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Erro ao listar interacoes: {str(e)}")


@app.post("/admin/leads/{lead_id}/interacoes", response_model=InteracaoLeadResponse)
def criar_interacao_lead(
    lead_id: int,
    dados: InteracaoLeadCreate,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """
    Cria uma nova interacao com o lead (nota, ligacao, email, etc).
    Requer permissão de SUPER ADMIN.
    """
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()

        if not lead:
            raise HTTPException(404, "Lead nao encontrado")

        interacao = InteracaoLead(
            lead_id=lead_id,
            tipo=dados.tipo,
            titulo=dados.titulo,
            descricao=dados.descricao,
            status_anterior=dados.status_anterior,
            status_novo=dados.status_novo,
            usuario_id=usuario.id
        )

        db.add(interacao)
        db.commit()
        db.refresh(interacao)

        return interacao

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Erro ao criar interacao: {str(e)}")


@app.get("/admin/leads/stats/dashboard")
def obter_stats_leads(
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """
    Retorna estatisticas gerais dos leads para dashboard do Super Admin.
    Requer permissão de SUPER ADMIN.
    """
    try:
        # Total de leads
        total_leads = db.query(Lead).count()

        # Leads por status
        leads_por_status = {}
        statuses = ["NOVO", "CONTATADO", "QUALIFICADO", "PROPOSTA_ENVIADA", "NEGOCIACAO", "CONVERTIDO", "PERDIDO"]
        for status in statuses:
            count = db.query(Lead).filter(Lead.status == status).count()
            leads_por_status[status] = count

        # Leads novos hoje
        hoje = datetime.utcnow().date()
        leads_hoje = db.query(Lead).filter(
            Lead.criado_em >= datetime.combine(hoje, datetime.min.time())
        ).count()

        # Leads novos ultimos 7 dias
        sete_dias_atras = datetime.utcnow() - timedelta(days=7)
        leads_semana = db.query(Lead).filter(
            Lead.criado_em >= sete_dias_atras
        ).count()

        # Taxa de conversao
        convertidos = leads_por_status.get("CONVERTIDO", 0)
        taxa_conversao = (convertidos / total_leads * 100) if total_leads > 0 else 0

        # Valor total potencial (soma de todas as faturas dos leads)
        valor_total_potencial = db.query(func.sum(Lead.valor_total_faturas)).scalar() or 0

        return {
            "total_leads": total_leads,
            "leads_por_status": leads_por_status,
            "leads_hoje": leads_hoje,
            "leads_semana": leads_semana,
            "taxa_conversao": round(taxa_conversao, 2),
            "valor_total_potencial": round(valor_total_potencial, 2)
        }

    except Exception as e:
        raise HTTPException(500, f"Erro ao obter stats: {str(e)}")
