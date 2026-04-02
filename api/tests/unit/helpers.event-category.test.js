import { describe, expect, test } from '@jest/globals';
import { normalizeEventCategoryId, readEventCategoryLabel } from '../../helpers/event-category.js';

describe('helpers/event-category', () => {
    test('normalizes known ids and labels to canonical ids', () => {
        expect(normalizeEventCategoryId('Reunião Interna')).toBe('reuniao');
        expect(normalizeEventCategoryId('evento acadêmico')).toBe('academico');
        expect(normalizeEventCategoryId('geral')).toBe('outro');
    });

    test('returns user-facing labels for known and unknown values', () => {
        expect(readEventCategoryLabel('extensao')).toBe('Extensão e Parceria');
        expect(readEventCategoryLabel('representacao')).toBe('Representação Institucional');
        expect(readEventCategoryLabel('feira-tecnologica')).toBe('Feira Tecnologica');
    });
});