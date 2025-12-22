"""
Geração de TXID para cobranças PIX

TXID é o identificador único de uma cobrança PIX.
Formato: MW + doc + nome + timestamp + random
Tamanho: 26-35 caracteres (RFC do BACEN)

Baseado no código de produção do n8n.
"""

import time
import random
import string
import unicodedata

# Configurações do TXID
PREFIX = "MW"  # Prefixo Midwest
MIN_LEN = 26   # Mínimo permitido pelo BACEN
MAX_LEN = 35   # Máximo permitido pelo BACEN
TARGET_LEN = 32  # Tamanho alvo


def _only_digits(s: str) -> str:
    """Remove tudo exceto dígitos."""
    if not s:
        return ""
    return "".join(c for c in str(s) if c.isdigit())


def _sanitize_ascii_upper(s: str) -> str:
    """
    Remove acentos e caracteres especiais, retorna uppercase.
    Mantém apenas letras e números.
    """
    if not s:
        return ""
    # Normaliza para decompor acentos (é -> e + ´)
    normalized = unicodedata.normalize("NFD", s)
    # Remove os caracteres de combinação (acentos)
    ascii_only = "".join(
        c for c in normalized if unicodedata.category(c) != "Mn"
    )
    # Mantém apenas alfanuméricos
    clean = "".join(c for c in ascii_only if c.isalnum())
    return clean.upper()


def _first_name(full_name: str) -> str:
    """Extrai e sanitiza o primeiro nome (max 8 caracteres)."""
    sanitized = _sanitize_ascii_upper(full_name)
    parts = sanitized.split()
    if not parts:
        return ""
    return parts[0][:8]


def _base36_now() -> str:
    """
    Gera timestamp atual em base36 (últimos 6 caracteres).
    Base36 usa 0-9 e A-Z, mais compacto que hex.
    """
    # Timestamp em milissegundos convertido para base36
    ts_ms = int(time.time() * 1000)

    # Converter para base36
    chars = string.digits + string.ascii_uppercase
    result = ""
    while ts_ms:
        result = chars[ts_ms % 36] + result
        ts_ms //= 36

    return result[-6:].upper()


def _rand_base36(n: int) -> str:
    """Gera n caracteres aleatórios em base36 (0-9, A-Z)."""
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=n))


def gerar_txid(
    nome: str,
    documento: str,
    uc: str = None
) -> str:
    """
    Gera TXID único para cobrança PIX.

    O TXID segue o padrão:
    - Prefixo: MW (Midwest)
    - Documento: CPF/CNPJ (apenas dígitos)
    - Nome: Primeiro nome (max 8 chars, sem acentos)
    - Timestamp: 6 chars em base36
    - Random: preenchimento até TARGET_LEN

    Args:
        nome: Nome completo do devedor
        documento: CPF ou CNPJ (pode ter formatação)
        uc: Código da UC (fallback se documento vazio)

    Returns:
        TXID válido com 26-35 caracteres

    Example:
        >>> gerar_txid("João da Silva", "123.456.789-01")
        'MW12345678901JOAO1A2B3CXYZABC'
    """
    # Extrair partes
    nome_part = _first_name(nome)
    doc_digits = _only_digits(documento)
    uc_digits = _only_digits(uc) if uc else ""

    # Usar documento, ou UC como fallback, ou zeros
    doc_part = doc_digits or uc_digits or "000000"

    # Timestamp em base36
    ts_part = _base36_now()

    # Montar core do TXID
    core = f"{PREFIX}{doc_part}{nome_part}{ts_part}"

    # Garantir que só tem caracteres válidos (A-Z, 0-9)
    core = "".join(c for c in core if c.isalnum()).upper()

    # Preencher até TARGET_LEN com random
    fill_needed = max(0, TARGET_LEN - len(core))
    if fill_needed > 0:
        core += _rand_base36(fill_needed)

    # Truncar se passou do máximo
    txid = core[:MAX_LEN]

    # Se ficou menor que o mínimo, completar com random
    if len(txid) < MIN_LEN:
        txid += _rand_base36(MIN_LEN - len(txid))

    return txid


def validar_txid(txid: str) -> bool:
    """
    Valida se um TXID está no formato correto.

    Args:
        txid: TXID a validar

    Returns:
        True se válido, False caso contrário
    """
    if not txid:
        return False

    # Verificar tamanho
    if len(txid) < MIN_LEN or len(txid) > MAX_LEN:
        return False

    # Verificar se só tem caracteres válidos (A-Z, a-z, 0-9)
    if not txid.isalnum():
        return False

    return True
