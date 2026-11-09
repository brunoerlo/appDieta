import { isBeverageEntry, getFoodBadgeLabel } from '../../src/utils/nutrition';
import { BEVERAGES_SEED, READY_DISHES_SEED, TACO_FOODS_SEED } from '../../src/database/seed/tacoFoods';

describe('Empirical Challenger R2: Beverage Detection & Stress Suite', () => {
  describe('1. Beverage Detection: Accented & Unaccented Variations', () => {
    const validBeverages = [
      // Café variations
      { foodName: 'café', expected: true },
      { foodName: 'Café', expected: true },
      { foodName: 'CAFÉ', expected: true },
      { foodName: 'cAfÉ', expected: true },
      { foodName: 'cafe', expected: true },
      { foodName: 'Cafe', expected: true },
      { foodName: 'CAFE', expected: true },
      { foodName: 'Café expresso', expected: true },
      { foodName: 'Café com leite desnatado', expected: true },
      { foodName: 'Cafe preto forte', expected: true },
      { foodName: 'Café gelado com whey', expected: true },

      // Água variations
      { foodName: 'água', expected: true },
      { foodName: 'Água', expected: true },
      { foodName: 'ÁGUA', expected: true },
      { foodName: 'agua', expected: true },
      { foodName: 'Agua', expected: true },
      { foodName: 'AGUA', expected: true },
      { foodName: 'Água mineral sem gás', expected: true },
      { foodName: 'Agua mineral com gas', expected: true },
      { foodName: 'Água de coco verde', expected: true },
      { foodName: 'ÁGUA COM LIMÃO', expected: true },

      // Chá variations
      { foodName: 'chá', expected: true },
      { foodName: 'Chá', expected: true },
      { foodName: 'CHÁ', expected: true },
      { foodName: 'cha', expected: true },
      { foodName: 'Cha', expected: true },
      { foodName: 'CHA', expected: true },
      { foodName: 'Chá verde gelado', expected: true },
      { foodName: 'Chá mate batido', expected: true },
      { foodName: 'Chá de camomila morno', expected: true },
      { foodName: 'CHÁ PRETO COM LIMÃO', expected: true },

      // Other drink types
      { foodName: 'Suco de laranja', expected: true },
      { foodName: 'SUCO NATURAL DE UVA', expected: true },
      { foodName: 'Refrigerante cola zero', expected: true },
      { foodName: 'Leite desnatado', expected: true },
      { foodName: 'Cerveja pilsen', expected: true },
      { foodName: 'Bebida vegetal de soja', expected: true },
      { foodName: 'Shake proteico', expected: true },
      { foodName: 'Vitamina de morango', expected: true },
      { foodName: 'Whey batido com água', expected: true },
      { foodName: 'Isotônico de tangerina', expected: true },
      { foodName: 'Energético tropical', expected: true },
      { foodName: 'Drink de frutas vermelhas', expected: true },
      { foodName: 'Kombucha de gengibre', expected: true },

      // Volume in name
      { foodName: 'Vitamina mista (300ml)', expected: true },
      { foodName: 'Suco concentrado 500 ml', expected: true },
      { foodName: 'Iogurte líquido 200mL', expected: true },
    ];

    it.each(validBeverages)('correctly flags beverage "$foodName" as $expected', ({ foodName, expected }) => {
      expect(isBeverageEntry({ foodName })).toBe(expected);
      expect(isBeverageEntry({ name: foodName })).toBe(expected);
    });
  });

  describe('2. Beverage Detection: Object Properties (ID, category, servingUnitName)', () => {
    it('detects drinks via ID prefix "drink-" regardless of name', () => {
      expect(isBeverageEntry({ foodId: 'drink-custom-123' })).toBe(true);
      expect(isBeverageEntry({ id: 'drink-custom-456' })).toBe(true);
      expect(isBeverageEntry({ id: 'drink-item', name: 'Item Sem Nome' })).toBe(true);
    });

    it('detects drinks via category "Bebidas"', () => {
      expect(isBeverageEntry({ category: 'Bebidas' })).toBe(true);
      expect(isBeverageEntry({ foodName: 'Qualquer Coisa', category: 'Bebidas' })).toBe(true);
    });

    it('detects drinks via servingUnitName containing "ml"', () => {
      expect(isBeverageEntry({ servingUnitName: 'copo (200ml)' })).toBe(true);
      expect(isBeverageEntry({ servingUnitName: 'lata (350ml)' })).toBe(true);
      expect(isBeverageEntry({ servingUnitName: 'garrafa (500mL)' })).toBe(true);
      expect(isBeverageEntry({ servingUnitName: '100ml' })).toBe(true);
    });

    it('handles null / undefined / empty objects safely without crashing', () => {
      expect(isBeverageEntry({})).toBe(false);
      expect(isBeverageEntry({ foodName: '' })).toBe(false);
      expect(isBeverageEntry({ name: '' })).toBe(false);
      expect(isBeverageEntry({ foodId: undefined, foodName: undefined })).toBe(false);
      expect(isBeverageEntry({ category: undefined })).toBe(false);
    });
  });

  describe('3. Beverage Detection: Negative Cases (Solid Foods & Non-Drink Items)', () => {
    const solidFoods = [
      'Arroz branco cozido',
      'Feijão carioca cozido',
      'Filé de frango grelhado',
      'Peito de peru defumado',
      'Ovo cozido',
      'Omelete simples',
      'Pão francês',
      'Pão de queijo',
      'Batata doce cozida',
      'Batata inglesa frita',
      'Mandioca cozida',
      'Carne moída bovina',
      'Patinho grelhado',
      'Salmão grelhado',
      'Tilápia ao forno',
      'Macarrão espaguete',
      'Lasanha à bolonhesa',
      'Espaguete à carbonara',
      'Strogonoff de frango',
      'Panqueca de carne',
      'Tapioca com frango',
      'Crepioca de queijo',
      'Queijo minas frescal',
      'Queijo muçarela',
      'Iogurte natural desnatado',
      'Maçã fuji',
      'Banana prata',
      'Morango fresco',
      'Abacate fresco',
      'Alface americana',
      'Tomate salada',
      'Cenoura ralada',
      'Brócolis cozido',
      'Aveia em flocos',
      'Granola tradicional',
      'Pasta de amendoim integral',
      'Castanha de caju',
      'Nozes',
      'Amêndoas torradas',
    ];

    it.each(solidFoods)('strictly identifies solid food "%s" as non-beverage (false)', (name) => {
      expect(isBeverageEntry({ foodName: name })).toBe(false);
    });
  });

  describe('4. Empirical Failure Mode Verifications (Adversarial Stress Test)', () => {
    it('verifies word-boundary matching prevents false triggers on solid foods containing "cha"', () => {
      const collisions = [
        'Bolacha',
        'Bolacha recheada',
        'Salsicha',
        'Salsicha de frango',
        'Champignon',
        'Champignon fresco',
        'Chantilly',
        'Chantilly spray',
        'Pão na chapa',
        'Picanha na chapa',
      ];

      for (const item of collisions) {
        expect(isBeverageEntry({ foodName: item })).toBe(false);
      }
    });

    it('verifies liquid medium and confectionery exceptions do not trigger on solid foods', () => {
      expect(isBeverageEntry({ foodName: 'Atum sólido em água' })).toBe(false);
      expect(isBeverageEntry({ foodName: 'Atum em água' })).toBe(false);
      expect(isBeverageEntry({ foodName: 'Sardinha em água e sal' })).toBe(false);
      expect(isBeverageEntry({ foodName: 'Doce de leite' })).toBe(false);
      expect(isBeverageEntry({ foodName: 'Doce de leite cremoso' })).toBe(false);
      expect(isBeverageEntry({ foodName: 'Leite em pó' })).toBe(false);
      expect(isBeverageEntry({ foodName: 'Leite em po integral' })).toBe(false);
    });

    it('verifies expanded beverage keywords with word boundaries match successfully', () => {
      const drinks = [
        'Guaraná Antarctica',
        'Coca-Cola Zero',
        'Pepsi Black',
        'Gatorade Tangerina',
        'Limonada Suíça',
        'Mate Gelado',
        'Red Bull Tropical',
        'Vinho Tinto',
        'Caldo de Cana',
        'Chá verde',
        'chá',
        'CHÁ MATE',
        'Café expresso',
        'Água mineral',
      ];

      for (const drink of drinks) {
        expect(isBeverageEntry({ foodName: drink })).toBe(true);
      }
    });
  });
});
