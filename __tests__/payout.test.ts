import { cbuError, walletError, normalizarCbu } from '@/lib/payout';

// Direcciones reales de contratos conocidos: sirven como muestras de formato
// válido sin exponer la wallet de nadie.
const TRON_OK = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const EVM_OK = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

describe('cbuError', () => {
  it('acepta 22 dígitos', () => {
    expect(cbuError('2850590940090418135201')).toBeNull();
  });

  it('ignora espacios y guiones al contar', () => {
    expect(cbuError('2850-5909-4009-0418-1352-01')).toBeNull();
  });

  it('rechaza si faltan dígitos y dice cuántos van', () => {
    expect(cbuError('285059094009041813520')).toContain('21');
  });

  it('rechaza letras', () => {
    expect(cbuError('28505909400904181352a1')).not.toBeNull();
  });

  it('pide el dato si está vacío', () => {
    expect(cbuError('')).toBe('Ingresá tu CBU');
  });
});

describe('walletError', () => {
  it('acepta una dirección de Tron en TRC20', () => {
    expect(walletError(TRON_OK, 'TRC20')).toBeNull();
  });

  it('acepta una dirección EVM en ERC20 y en POLYGON', () => {
    expect(walletError(EVM_OK, 'ERC20')).toBeNull();
    expect(walletError(EVM_OK, 'POLYGON')).toBeNull();
  });

  // 🔴 EL test que justifica todo el módulo. Las dos direcciones son válidas
  // en su propia red; cruzarlas es lo que pierde los fondos para siempre.
  it('rechaza una dirección EVM declarada como TRC20', () => {
    expect(walletError(EVM_OK, 'TRC20')).not.toBeNull();
  });

  it('rechaza una dirección de Tron declarada como ERC20', () => {
    expect(walletError(TRON_OK, 'ERC20')).not.toBeNull();
  });

  it('rechaza base58 inválido (Tron no usa 0, O, I ni l)', () => {
    expect(walletError('T0' + TRON_OK.slice(2), 'TRC20')).not.toBeNull();
  });

  it('rechaza una dirección EVM sin el 0x', () => {
    expect(walletError(EVM_OK.slice(2), 'ERC20')).not.toBeNull();
  });

  it('rechaza por largo aunque el prefijo esté bien', () => {
    expect(walletError(EVM_OK + 'ab', 'ERC20')).not.toBeNull();
    expect(walletError(TRON_OK.slice(0, -1), 'TRC20')).not.toBeNull();
  });

  it('tolera espacios pegados al copiar y pegar', () => {
    expect(walletError(`  ${EVM_OK}  `, 'ERC20')).toBeNull();
  });

  it('pide el dato si está vacío', () => {
    expect(walletError('   ', 'TRC20')).toBe('Ingresá tu dirección');
  });
});

describe('normalizarCbu', () => {
  it('deja solo los dígitos', () => {
    expect(normalizarCbu('2850-5909 4009.0418/1352 01')).toBe('2850590940090418135201');
  });
});
