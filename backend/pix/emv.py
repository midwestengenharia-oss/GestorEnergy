"""
Geração de EMV (código copia-e-cola) para QR Code PIX

EMV é o padrão internacional para QR Codes de pagamento.
O PIX brasileiro segue o padrão EMV-QRCPS (QR Code Payment Specification).

Este módulo gera a string EMV que pode ser:
1. Usada como "copia e cola"
2. Convertida em QR Code

Baseado no código de produção do n8n.
"""

import unicodedata


def _tlv(tag: str, value: str) -> str:
    """
    Monta um campo TLV (Tag-Length-Value).

    Formato: TAG (2 chars) + LENGTH (2 chars, zero-padded) + VALUE

    Args:
        tag: Código do campo (2 dígitos)
        value: Valor do campo

    Returns:
        String TLV formatada

    Example:
        >>> _tlv('00', '01')
        '000201'
    """
    return f"{tag}{len(value):02d}{value}"


def _crc16_ccitt(data: str) -> str:
    """
    Calcula CRC16-CCITT (polinômio 0x1021).

    Este é o checksum usado pelo padrão EMV PIX.

    Args:
        data: String para calcular CRC

    Returns:
        CRC em hexadecimal (4 caracteres, uppercase)
    """
    crc = 0xFFFF
    for char in data:
        crc ^= (ord(char) & 0xFF) << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    return f"{crc:04X}"


def _sanitize_name(s: str, max_len: int = 25) -> str:
    """
    Sanitiza nome para EMV: remove acentos, mantém apenas ASCII.

    Args:
        s: String a sanitizar
        max_len: Tamanho máximo

    Returns:
        String sanitizada e truncada
    """
    if not s:
        return ""
    # Remove acentos
    normalized = unicodedata.normalize("NFD", s)
    ascii_only = "".join(
        c for c in normalized if unicodedata.category(c) != "Mn"
    )
    # Mantém apenas caracteres ASCII printáveis básicos
    clean = "".join(c for c in ascii_only if c.isalnum() or c == " ")
    return clean.upper()[:max_len]


def gerar_emv(
    pix_copia_cola: str = None,
    location: str = None,
    valor: str = None,
    recebedor_nome: str = "MIDWEST ENERGIAS LTDA",
    recebedor_cidade: str = "CUIABA"
) -> str:
    """
    Gera string EMV para QR Code PIX.

    Se `pix_copia_cola` for fornecido (vindo do Santander), retorna diretamente.
    Caso contrário, monta o EMV a partir do `location`.

    Args:
        pix_copia_cola: String EMV completa (se já recebida do PSP)
        location: URL do payload PIX (para QR dinâmico)
        valor: Valor da cobrança (ex: "150.00")
        recebedor_nome: Nome do recebedor (max 25 chars)
        recebedor_cidade: Cidade do recebedor (max 15 chars)

    Returns:
        String EMV pronta para QR Code

    Raises:
        ValueError: Se nem pix_copia_cola nem location forem fornecidos

    Example:
        >>> emv = gerar_emv(
        ...     location="pix.santander.com.br/qr/v2/cobv/xxx",
        ...     valor="150.00"
        ... )
        >>> emv.startswith("00020126")
        True
    """
    # Se já tem o EMV do PSP, usar diretamente
    if pix_copia_cola:
        return pix_copia_cola.strip()

    # Precisa do location para montar
    if not location:
        raise ValueError("Necessário fornecer pix_copia_cola ou location")

    # Sanitizar dados do recebedor
    nome = _sanitize_name(recebedor_nome, 25)
    cidade = _sanitize_name(recebedor_cidade, 15)

    # Limitar location a 77 caracteres (limite do campo 25)
    loc_capped = location.lower()[:77]

    # Montar MAI (Merchant Account Information) - Tag 26
    # Subtag 00: GUI do PIX brasileiro
    # Subtag 25: URL do payload (QR dinâmico)
    mai_content = _tlv("00", "br.gov.bcb.pix") + _tlv("25", loc_capped)

    # Montar payload EMV
    payload = (
        _tlv("00", "01") +           # Payload Format Indicator
        _tlv("01", "12") +           # Point of Initiation: 12 = QR dinâmico
        _tlv("26", mai_content) +    # Merchant Account Information
        _tlv("52", "0000") +         # Merchant Category Code
        _tlv("53", "986") +          # Transaction Currency: 986 = BRL
        _tlv("54", valor) +          # Transaction Amount
        _tlv("58", "BR") +           # Country Code
        _tlv("59", nome) +           # Merchant Name
        _tlv("60", cidade)           # Merchant City
    )

    # Dados adicionais (Tag 62) - Campo de referência
    additional_data = _tlv("05", "***")  # Reference Label
    payload += _tlv("62", additional_data)

    # Adicionar placeholder do CRC
    payload_with_crc_tag = payload + "6304"

    # Calcular e adicionar CRC
    crc = _crc16_ccitt(payload_with_crc_tag)

    return payload_with_crc_tag + crc


def validar_emv(emv: str) -> bool:
    """
    Valida se uma string EMV tem CRC correto.

    Args:
        emv: String EMV a validar

    Returns:
        True se CRC válido, False caso contrário
    """
    if not emv or len(emv) < 8:
        return False

    # Últimos 4 chars são o CRC
    payload = emv[:-4]
    crc_informado = emv[-4:].upper()

    # Calcular CRC esperado
    crc_calculado = _crc16_ccitt(payload)

    return crc_informado == crc_calculado
