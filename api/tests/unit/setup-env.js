process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-secret';
process.env.MYSQL_DATABASE ??= 'event_hub';
process.env.MYSQL_ROOT_PASSWORD ??= 'root';
process.env.TEST_DATABASE_ID ??= 'suite';