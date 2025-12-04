"""
Session Manager - Gerenciamento de sessões da Energisa no banco de dados
"""

import time
import logging
from datetime import datetime, timezone, timedelta

from backend.core.database import db_admin

logger = logging.getLogger(__name__)

# Tempo máximo de validade da sessão (24 horas)
MAX_SESSION_AGE_HOURS = 24


class SessionManager:
    @staticmethod
    def _clean_cpf(cpf: str) -> str:
        """Remove pontos e traços do CPF"""
        return cpf.replace(".", "").replace("-", "")

    @staticmethod
    def save_session(cpf: str, cookies: dict):
        """
        Salva sessão no banco de dados.

        Args:
            cpf: CPF do titular
            cookies: Dict com cookies da sessão
        """
        cpf_clean = SessionManager._clean_cpf(cpf)

        try:
            # Upsert - insere ou atualiza se já existir
            data = {
                "cpf": cpf_clean,
                "cookies": cookies,
                "atualizado_em": datetime.now(timezone.utc).isoformat()
            }

            db_admin.table("sessoes_energisa").upsert(
                data,
                on_conflict="cpf"
            ).execute()

            logger.info(f"💾 Sessão salva no banco para CPF: {cpf_clean[:3]}***")
            print(f"💾 Sessão salva no banco para CPF: {cpf_clean[:3]}***")

        except Exception as e:
            logger.error(f"❌ Erro ao salvar sessão no banco: {e}")
            print(f"❌ Erro ao salvar sessão no banco: {e}")
            raise

    @staticmethod
    def load_session(cpf: str):
        """
        Carrega sessão do banco de dados.

        Args:
            cpf: CPF do titular

        Returns:
            Dict com cookies ou None se não encontrado/expirado
        """
        cpf_clean = SessionManager._clean_cpf(cpf)

        try:
            result = db_admin.table("sessoes_energisa").select(
                "cookies, atualizado_em"
            ).eq("cpf", cpf_clean).execute()

            if not result.data:
                logger.warning(f"⚠️ Sessão não encontrada no banco para CPF: {cpf_clean[:3]}***")
                print(f"⚠️ Sessão não encontrada no banco para CPF: {cpf_clean[:3]}***")
                return None

            session_data = result.data[0]
            atualizado_em = session_data.get("atualizado_em")

            # Verifica idade da sessão
            if atualizado_em:
                session_time = datetime.fromisoformat(atualizado_em.replace("Z", "+00:00"))
                now = datetime.now(timezone.utc)
                age = now - session_time
                max_age = timedelta(hours=MAX_SESSION_AGE_HOURS)

                logger.info(f"🔍 Verificando sessão para CPF {cpf_clean[:3]}***:")
                logger.info(f"   📅 Atualizada em: {session_time.isoformat()}")
                logger.info(f"   ⏱️ Idade: {age.total_seconds():.0f}s (Máx: {max_age.total_seconds():.0f}s)")

                print(f"🔍 Verificando sessão para CPF {cpf_clean[:3]}***:")
                print(f"   📅 Atualizada em: {session_time.isoformat()}")
                print(f"   ⏱️ Idade: {age.total_seconds():.0f}s (Máx: {max_age.total_seconds():.0f}s)")

                if age > max_age:
                    logger.warning("   ❌ Sessão expirada!")
                    print("   ❌ Sessão expirada!")
                    return None

            logger.info("   ✅ Sessão válida.")
            print("   ✅ Sessão válida.")
            return session_data.get("cookies")

        except Exception as e:
            logger.error(f"❌ Erro ao carregar sessão do banco: {e}")
            print(f"❌ Erro ao carregar sessão do banco: {e}")
            return None

    @staticmethod
    def delete_session(cpf: str):
        """
        Remove sessão do banco de dados.

        Args:
            cpf: CPF do titular
        """
        cpf_clean = SessionManager._clean_cpf(cpf)

        try:
            db_admin.table("sessoes_energisa").delete().eq(
                "cpf", cpf_clean
            ).execute()

            logger.info(f"🗑️ Sessão removida do banco para CPF: {cpf_clean[:3]}***")
            print(f"🗑️ Sessão removida do banco para CPF: {cpf_clean[:3]}***")

        except Exception as e:
            logger.error(f"❌ Erro ao remover sessão do banco: {e}")
            print(f"❌ Erro ao remover sessão do banco: {e}")

    @staticmethod
    def session_exists(cpf: str) -> bool:
        """
        Verifica se existe sessão válida para o CPF.

        Args:
            cpf: CPF do titular

        Returns:
            True se existir sessão válida
        """
        return SessionManager.load_session(cpf) is not None
