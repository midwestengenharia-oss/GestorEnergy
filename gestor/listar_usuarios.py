"""
Script para listar todos os usuários e tornar o primeiro super admin automaticamente.
"""
from database import SessionLocal, Usuario

def main():
    db = SessionLocal()
    try:
        usuarios = db.query(Usuario).all()

        if not usuarios:
            print("NENHUM USUÁRIO CADASTRADO")
            print("\n1. Cadastre-se em: http://localhost:3000/app")
            print("2. Depois execute este script novamente")
            return

        print("\n=== USUÁRIOS CADASTRADOS ===\n")
        print(f"{'ID':<5} {'Nome':<30} {'Email':<40} {'Super Admin'}")
        print("-" * 100)

        for user in usuarios:
            is_admin = "✓ SIM" if user.is_superadmin else "NÃO"
            print(f"{user.id:<5} {user.nome_completo:<30} {user.email:<40} {is_admin}")

        # Se nenhum é super admin, torna o primeiro
        tem_superadmin = any(u.is_superadmin for u in usuarios)

        if not tem_superadmin:
            print("\n⚠️  NENHUM SUPER ADMIN ENCONTRADO!")
            print(f"✅ Tornando '{usuarios[0].nome_completo}' (ID: {usuarios[0].id}) SUPER ADMIN automaticamente...")

            usuarios[0].is_superadmin = True
            db.commit()

            print("✅ CONCLUÍDO! Faça login novamente para ver as páginas de admin.\n")
        else:
            print("\n")

        # Instruções
        print("=" * 100)
        print("\nPara tornar outro usuário super admin, execute no container:")
        print("  docker exec energisa_gestor python -c \"from database import SessionLocal, Usuario; db = SessionLocal(); u = db.query(Usuario).get(ID); u.is_superadmin = True; db.commit(); print('OK')\"")
        print("\n(Substitua ID pelo número do usuário)")
        print("=" * 100)

    except Exception as e:
        print(f"ERRO: {str(e)}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()
