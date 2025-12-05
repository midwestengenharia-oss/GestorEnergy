"""
Sync Scheduler - Agendador de sincronização automática
Executa a sincronização a cada 10 minutos
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


class SyncScheduler:
    """Agendador de sincronização com a Energisa"""

    def __init__(self, interval_minutes: int = 120):
        """
        Args:
            interval_minutes: Intervalo entre sincronizações em minutos
        """
        self.interval_seconds = interval_minutes * 60
        self._task: Optional[asyncio.Task] = None
        self._running = False
        self._last_sync: Optional[datetime] = None
        self._last_stats: Optional[dict] = None

    async def _sync_loop(self):
        """Loop principal de sincronização"""
        from backend.sync.service import sync_service

        logger.info(f"🚀 Scheduler iniciado - Sincronização a cada {self.interval_seconds // 60} minutos")

        while self._running:
            try:
                logger.info(f"⏰ Executando sincronização programada...")
                self._last_sync = datetime.now()

                # Executa sincronização
                stats = await sync_service.sincronizar_todas_ucs()
                self._last_stats = stats

                logger.info(f"✅ Sincronização concluída. Próxima em {self.interval_seconds // 60} minutos.")

            except Exception as e:
                logger.error(f"❌ Erro na sincronização programada: {e}")

            # Aguarda o intervalo
            await asyncio.sleep(self.interval_seconds)

    def start(self):
        """Inicia o scheduler"""
        if self._running:
            logger.warning("⚠️ Scheduler já está rodando")
            return

        self._running = True
        self._task = asyncio.create_task(self._sync_loop())
        logger.info("✅ Sync Scheduler iniciado")

    def stop(self):
        """Para o scheduler"""
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None
        logger.info("🛑 Sync Scheduler parado")

    def get_status(self) -> dict:
        """Retorna status do scheduler"""
        return {
            "running": self._running,
            "interval_minutes": self.interval_seconds // 60,
            "last_sync": self._last_sync.isoformat() if self._last_sync else None,
            "last_stats": self._last_stats
        }


# Instância global do scheduler
sync_scheduler = SyncScheduler(interval_minutes=10)
