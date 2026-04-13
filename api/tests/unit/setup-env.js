process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-secret';
process.env.MYSQL_DATABASE ??= 'agenda_ch';
process.env.MYSQL_ROOT_PASSWORD ??= 'root';
process.env.GOOGLE_CALENDAR_ENABLED ??= 'false';
process.env.TEST_DATABASE_ID ??= 'suite';