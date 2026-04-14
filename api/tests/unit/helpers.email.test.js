import { jest } from '@jest/globals';

const transporterMock = {
    sendMail: jest.fn(),
    verify: jest.fn(),
    close: jest.fn(),
};

const createTransportMock = jest.fn(() => transporterMock);
const createTestAccountMock = jest.fn(async () => ({
    smtp: {
        host: 'ethereal.local',
        port: 587,
        secure: false,
    },
    user: 'ethereal-user',
    pass: 'ethereal-pass',
}));
const getTestMessageUrlMock = jest.fn(() => 'https://preview.local/message');

const mjml2htmlMock = jest.fn(() => ({
    html: '<html>ok</html>',
    errors: [],
}));
const htmlToTextMock = jest.fn(() => 'generated plain text');

jest.unstable_mockModule('nodemailer', () => ({
    default: {
        createTransport: createTransportMock,
        createTestAccount: createTestAccountMock,
        getTestMessageUrl: getTestMessageUrlMock,
    },
}));

jest.unstable_mockModule('mjml', () => ({
    default: mjml2htmlMock,
}));

jest.unstable_mockModule('html-to-text', () => ({
    convert: htmlToTextMock,
}));

const { Email } = await import('../../helpers/email.js');

describe('helpers/email', () => {
    beforeEach(() => {
        createTransportMock.mockClear();
        createTestAccountMock.mockClear();
        getTestMessageUrlMock.mockClear();
        mjml2htmlMock.mockClear();
        htmlToTextMock.mockClear().mockReturnValue('generated plain text');
        transporterMock.sendMail.mockReset().mockResolvedValue({ messageId: 'msg-1' });
        transporterMock.verify.mockReset().mockResolvedValue(true);
        transporterMock.close.mockReset();
    });

    test('send throws for empty recipients array', async () => {
        const email = new Email({ testing: true });

        await expect(email.send([], 'Subject', 'Body')).rejects.toThrow('Recipients must be a non-empty array');
    });

    test('send throws for invalid email format', async () => {
        const email = new Email({ testing: true });

        await expect(email.send(['invalid-email'], 'Subject', 'Body')).rejects.toThrow('Invalid email address: invalid-email');
    });

    test('send throws when subject is missing and no default subject', async () => {
        const email = new Email({ testing: true });

        await expect(email.send(['user@example.com'], null, 'Body')).rejects.toThrow('Subject is required');
    });

    test('send throws when body is missing', async () => {
        const email = new Email({ testing: true });

        await expect(email.send(['user@example.com'], 'Subject')).rejects.toThrow('Body is required');
    });

    test('send validates cc and bcc recipients', async () => {
        const email = new Email({ testing: true });

        await expect(email.send(
            ['user@example.com'],
            'Subject',
            'Body',
            { cc: ['invalid-email'] },
        )).rejects.toThrow('Invalid email address: invalid-email');

        await expect(email.send(
            ['user@example.com'],
            'Subject',
            'Body',
            { bcc: ['still-invalid'] },
        )).rejects.toThrow('Invalid email address: still-invalid');
    });

    test('testing mode send creates a test transporter and sends plain text', async () => {
        const email = new Email({ testing: true });

        await email.send(['user@example.com'], 'Hello', 'Plain text body');

        expect(createTestAccountMock).toHaveBeenCalledTimes(1);
        expect(createTransportMock).toHaveBeenCalledTimes(1);
        expect(transporterMock.sendMail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'user@example.com',
            subject: 'Hello',
            text: 'Plain text body',
            html: undefined,
        }));
        expect(getTestMessageUrlMock).toHaveBeenCalledTimes(1);
    });

    test('send includes recipient names in mail headers when available', async () => {
        const email = new Email({ testing: true });

        await email.send([
            {
                email: 'user@example.com',
                name: 'Ada Lovelace',
            },
        ], 'Hello', 'Plain text body');

        expect(transporterMock.sendMail).toHaveBeenCalledWith(expect.objectContaining({
            to: '"Ada Lovelace" <user@example.com>',
        }));
    });

    test('send normalizes string cc and bcc recipients before sending', async () => {
        const email = new Email({ testing: true });

        await email.send(['user@example.com'], 'Hello', 'Plain text body', {
            cc: 'cc@example.com',
            bcc: 'bcc@example.com',
        });

        expect(transporterMock.sendMail).toHaveBeenCalledWith(expect.objectContaining({
            cc: 'cc@example.com',
            bcc: 'bcc@example.com',
        }));
    });

    test('send formats named cc and bcc recipients before sending', async () => {
        const email = new Email({ testing: true });

        await email.send(['user@example.com'], 'Hello', 'Plain text body', {
            cc: [{ email: 'cc@example.com', name: 'Coordenação' }],
            bcc: [{ email: 'bcc@example.com', name: 'Equipe Interna' }],
        });

        expect(transporterMock.sendMail).toHaveBeenCalledWith(expect.objectContaining({
            cc: '"Coordenação" <cc@example.com>',
            bcc: '"Equipe Interna" <bcc@example.com>',
        }));
    });

    test('MJML body is compiled and sent as HTML', async () => {
        const email = new Email({ testing: true });

        await email.send(['user@example.com'], 'MJML', '<mjml><mj-body><mj-text>Hi</mj-text></mj-body></mjml>');

        expect(mjml2htmlMock).toHaveBeenCalledTimes(1);
        expect(htmlToTextMock).toHaveBeenCalledWith('<html>ok</html>', expect.any(Object));
        expect(transporterMock.sendMail).toHaveBeenCalledWith(expect.objectContaining({
            subject: 'MJML',
            html: '<html>ok</html>',
            text: 'generated plain text',
        }));
    });

    test('HTML body is forwarded without MJML compilation', async () => {
        const email = new Email({ testing: true });

        await email.send(['user@example.com'], 'HTML', '<p><strong>Olá</strong></p>');

        expect(mjml2htmlMock).not.toHaveBeenCalled();
        expect(htmlToTextMock).toHaveBeenCalledWith('<p><strong>Olá</strong></p>', expect.any(Object));
        expect(transporterMock.sendMail).toHaveBeenCalledWith(expect.objectContaining({
            subject: 'HTML',
            html: '<p><strong>Olá</strong></p>',
            text: 'generated plain text',
        }));
    });

    test('explicit text overrides the generated HTML fallback', async () => {
        const email = new Email({ testing: true });

        await email.send(['user@example.com'], 'HTML', '<p>Olá</p>', {
            text: 'manual plain text',
        });

        expect(transporterMock.sendMail).toHaveBeenCalledWith(expect.objectContaining({
            html: '<p>Olá</p>',
            text: 'manual plain text',
        }));
    });

    test('MJML body preserves header-like text content', async () => {
        const email = new Email({ testing: true });
        const mjmlBody = '<mjml>\n<mj-body>\n<mj-text>Aviso: o link da proposta fica ativo por 48 horas.</mj-text>\n</mj-body>\n</mjml>';

        await email.send(['user@example.com'], 'MJML', mjmlBody);

        expect(mjml2htmlMock).toHaveBeenCalledWith(
            expect.stringContaining('Aviso: o link da proposta fica ativo por 48 horas.'),
            expect.any(Object),
        );
    });

    test('send sanitizes header-like injected lines in plain text body', async () => {
        const email = new Email({ testing: true });

        await email.send(['user@example.com'], 'Hello', 'Plain line\nBcc:evil@example.com\nAnother line');

        expect(transporterMock.sendMail).toHaveBeenCalledWith(expect.objectContaining({
            text: expect.not.stringContaining('Bcc:'),
        }));
    });

    test('send wraps transporter errors', async () => {
        const email = new Email({ testing: true });
        transporterMock.sendMail.mockRejectedValueOnce(new Error('smtp timeout'));

        await expect(email.send(['user@example.com'], 'Subject', 'Body')).rejects.toThrow('Failed to send email: smtp timeout');
    });

    test('verify returns true in testing mode', async () => {
        const email = new Email({ testing: true });

        await expect(email.verify()).resolves.toBe(true);
        expect(transporterMock.verify).not.toHaveBeenCalled();
    });

    test('verify in non-testing mode calls transporter.verify and returns true', async () => {
        const email = new Email({ testing: false, host: 'smtp.local', port: 587, secure: false });

        await expect(email.verify()).resolves.toBe(true);
        expect(transporterMock.verify).toHaveBeenCalledTimes(1);
    });

    test('close in non-testing mode calls transporter.close', () => {
        const email = new Email({ testing: false, host: 'smtp.local', port: 587, secure: false });

        email.close();

        expect(transporterMock.close).toHaveBeenCalledTimes(1);
    });

    test('close in testing mode does not call transporter close', () => {
        const email = new Email({ testing: true });

        email.close();

        expect(transporterMock.close).not.toHaveBeenCalled();
    });
});