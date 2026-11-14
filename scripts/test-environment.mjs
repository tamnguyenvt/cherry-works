// What every test runs under, whatever the terminal that started the suite
// set: no forced colour, since a test asks for none with NO_COLOR, and node
// warns on stderr where both are set (`pnpm test`).
delete process.env.FORCE_COLOR;
