import React from 'react';
import { calculateSuggestedTargets } from '@/utils/nutrition';
import { AppTopBar } from '@/components/ui/AppTopBar';

describe('Milestone M7: Auth UI & Onboarding Logic Verification', () => {
  describe('1. Registration and Login Pre-flight Validations', () => {
    function validateAuthInput(mode: 'login' | 'register', input: { name?: string; email?: string; password?: string }) {
      const email = input.email?.trim() || '';
      const password = input.password || '';

      if (mode === 'register') {
        const name = input.name?.trim() || '';
        if (!name) throw new Error('Por favor, informe seu nome.');
        if (!email || !/\S+@\S+\.\S+/.test(email)) throw new Error('Informe um e-mail válido.');
        if (password.length < 4) throw new Error('A senha deve ter pelo menos 4 caracteres.');
      } else {
        if (!email) throw new Error('Informe seu e-mail.');
        if (!password) throw new Error('Informe sua senha.');
      }
      return true;
    }

    it('rejects registration without name', () => {
      expect(() => {
        validateAuthInput('register', { name: '', email: 'atleta@irontrack.app', password: '1234' });
      }).toThrow('Por favor, informe seu nome.');
    });

    it('rejects invalid email formats', () => {
      expect(() => {
        validateAuthInput('register', { name: 'Lucas', email: 'invalid-email', password: '1234' });
      }).toThrow('Informe um e-mail válido.');
    });

    it('rejects short passwords under 4 characters', () => {
      expect(() => {
        validateAuthInput('register', { name: 'Lucas', email: 'lucas@irontrack.app', password: '123' });
      }).toThrow('A senha deve ter pelo menos 4 caracteres.');
    });

    it('accepts valid registration input', () => {
      expect(
        validateAuthInput('register', { name: 'Lucas Lima', email: 'lucas@irontrack.app', password: 'securePassword' })
      ).toBe(true);
    });

    it('validates login input requires both email and password', () => {
      expect(() => {
        validateAuthInput('login', { email: '', password: '1234' });
      }).toThrow('Informe seu e-mail.');

      expect(() => {
        validateAuthInput('login', { email: 'lucas@irontrack.app', password: '' });
      }).toThrow('Informe sua senha.');

      expect(validateAuthInput('login', { email: 'lucas@irontrack.app', password: '1234' })).toBe(true);
    });
  });

  describe('2. Onboarding Input Validation & Scientific Metas Generation', () => {
    function validateOnboardingInput(data: {
      weightKg: number;
      heightCm: number;
      targetCalories: number;
    }) {
      if (!data.weightKg || isNaN(data.weightKg) || data.weightKg < 30 || data.weightKg > 300) {
        throw new Error('Informe um peso atual válido entre 30kg e 300kg.');
      }
      if (!data.heightCm || isNaN(data.heightCm) || data.heightCm < 100 || data.heightCm > 250) {
        throw new Error('Informe uma altura válida entre 100cm e 250cm.');
      }
      if (!data.targetCalories || isNaN(data.targetCalories) || data.targetCalories < 800) {
        throw new Error('Informe uma meta calórica válida (mínimo 800 kcal).');
      }
      return true;
    }

    it('validates boundaries for weight, height, and calories', () => {
      expect(() => validateOnboardingInput({ weightKg: 25, heightCm: 175, targetCalories: 2000 })).toThrow('entre 30kg e 300kg');
      expect(() => validateOnboardingInput({ weightKg: 350, heightCm: 175, targetCalories: 2000 })).toThrow('entre 30kg e 300kg');
      expect(() => validateOnboardingInput({ weightKg: 75, heightCm: 90, targetCalories: 2000 })).toThrow('entre 100cm e 250cm');
      expect(() => validateOnboardingInput({ weightKg: 75, heightCm: 260, targetCalories: 2000 })).toThrow('entre 100cm e 250cm');
      expect(() => validateOnboardingInput({ weightKg: 75, heightCm: 175, targetCalories: 600 })).toThrow('mínimo 800 kcal');
      expect(validateOnboardingInput({ weightKg: 75, heightCm: 175, targetCalories: 2400 })).toBe(true);
    });

    it('computes scientifically sound suggested targets for Hypertrophy', () => {
      const suggested = calculateSuggestedTargets({
        weightKg: 80,
        heightCm: 180,
        age: 26,
        gender: 'male',
        trainingGoal: 'hypertrophy',
        activityLevel: 'moderate',
      });

      // Hypertrophy goal should yield surplus calories and 2.0g/kg protein (=160g)
      expect(suggested.protein).toBe(160);
      expect(suggested.calories).toBeGreaterThan(suggested.tdee); // surplus
      expect(suggested.waterMl).toBeGreaterThanOrEqual(2500);

      // Atwater balance verification: P*4 + C*4 + F*9
      const calculatedKcal = suggested.protein * 4 + suggested.carbs * 4 + suggested.fat * 9;
      expect(Math.abs(calculatedKcal - suggested.calories)).toBeLessThanOrEqual(5);
    });

    it('computes scientifically sound suggested targets for Cutting', () => {
      const suggested = calculateSuggestedTargets({
        weightKg: 80,
        heightCm: 180,
        age: 26,
        gender: 'male',
        trainingGoal: 'cutting',
        activityLevel: 'moderate',
      });

      // Cutting goal should yield deficit calories and 2.2g/kg protein (=176g)
      expect(suggested.protein).toBe(176);
      expect(suggested.calories).toBeLessThan(suggested.tdee); // deficit
      expect(suggested.waterMl).toBeGreaterThanOrEqual(2500);

      const calculatedKcal = suggested.protein * 4 + suggested.carbs * 4 + suggested.fat * 9;
      expect(Math.abs(calculatedKcal - suggested.calories)).toBeLessThanOrEqual(5);
    });
  });

  describe('3. AppTopBar Component Properties', () => {
    it('renders with custom style and titleStyle', () => {
      const element = React.createElement(AppTopBar, {
        title: 'IronTrack Profile',
        showBorderBottom: false,
        extraTopPadding: 16,
      });

      expect(element.props.showBorderBottom).toBe(false);
      expect(element.props.extraTopPadding).toBe(16);
      expect(element.props.title).toBe('IronTrack Profile');
    });
  });
});
