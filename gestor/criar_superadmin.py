"""
Script para tornar um usuário super admin.
Uso: python criar_superadmin.py
"""
from database import SessionLocal, Usuario
import sys

def listar_usuarios():
    """Lista todos os usuários cadastrados"""
    db = SessionLocal()
    try:
        usuarios = db.query(Usuario).all()

        if not usuarios:
            print("Nenhum usuário cadastrado no sistema.")
            return None

        print("\n=== USUÁRIOS CADASTRADOS ===")
        print(f"{'ID':<5} {'Nome':<30} {'Email':<35} {'Super Admin':<15}")
        print("-" * 90)

        for user in usuarios:
            is_admin = "✓ SIM" if user.is_superadmin else "NÃO"
            print(f"{user.id:<5} {user.nome_completo:<30} {user.email:<35} {is_admin:<15}")

        return usuarios
    finally:
        db.close()


def tornar_superadmin(user_id: int):
    """Torna um usuário super admin"""
    db = SessionLocal()
    try:
        usuario = db.query(Usuario).filter(Usuario.id == user_id).first()

        if not usuario:
            print(f"❌ Erro: Usuário com ID {user_id} não encontrado.")
            return False

        if usuario.is_superadmin:
            print(f"ℹ️  O usuário '{usuario.nome_completo}' já é super admin.")
            return True

        usuario.is_superadmin = True
        db.commit()

        print(f"✅ Sucesso! O usuário '{usuario.nome_completo}' agora é SUPER ADMIN.")
        return True

    except Exception as e:
        db.rollback()
        print(f"❌ Erro ao atualizar usuário: {str(e)}")
        return False
    finally:
        db.close()


def remover_superadmin(user_id: int):
    """Remove permissão de super admin de um usuário"""
    db = SessionLocal()
    try:
        usuario = db.query(Usuario).filter(Usuario.id == user_id).first()

        if not usuario:
            print(f"❌ Erro: Usuário com ID {user_id} não encontrado.")
            return False

        if not usuario.is_superadmin:
            print(f"ℹ️  O usuário '{usuario.nome_completo}' não é super admin.")
            return True

        usuario.is_superadmin = False
        db.commit()

        print(f"✅ Permissão de super admin removida de '{usuario.nome_completo}'.")
        return True

    except Exception as e:
        db.rollback()
        print(f"❌ Erro ao atualizar usuário: {str(e)}")
        return False
    finally:
        db.close()


def main():
    print("\n" + "=" * 90)
    print(" " * 30 + "GERENCIAR SUPER ADMINS")
    print("=" * 90)

    # Lista usuários
    usuarios = listar_usuarios()

    if not usuarios:
        print("\n⚠️  Cadastre um usuário primeiro através do sistema de registro.")
        return

    print("\n" + "=" * 90)
    print("\nOpções:")
    print("  1. Tornar usuário SUPER ADMIN")
    print("  2. Remover permissão de SUPER ADMIN")
    print("  3. Sair")

    try:
        opcao = input("\nEscolha uma opção (1-3): ").strip()

        if opcao == "3":
            print("\n👋 Saindo...")
            return

        if opcao not in ["1", "2"]:
            print("❌ Opção inválida.")
            return

        user_id = input("\nDigite o ID do usuário: ").strip()

        try:
            user_id = int(user_id)
        except ValueError:
            print("❌ ID inválido. Digite um número.")
            return

        if opcao == "1":
            tornar_superadmin(user_id)
        elif opcao == "2":
            remover_superadmin(user_id)

        print("\n" + "=" * 90)

    except KeyboardInterrupt:
        print("\n\n👋 Operação cancelada.")
    except Exception as e:
        print(f"\n❌ Erro: {str(e)}")


if __name__ == "__main__":
    main()
