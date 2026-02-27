const BASE_URL = 'http://localhost:3000/api';

async function testApi() {
  try {
    // 1. Login
    console.log('Logging in...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@prefeitura.gov.br',
        senha: 'admin123'
      })
    });

    if (!loginRes.ok) {
      console.error('Login failed:', await loginRes.text());
      return;
    }

    const cookie = loginRes.headers.get('set-cookie');
    console.log('Login successful. Cookie:', cookie);

    // 2. Get Veiculos
    console.log('Fetching veiculos...');
    const veiculosRes = await fetch(`${BASE_URL}/veiculos`, {
      headers: {
        'Cookie': cookie
      }
    });

    if (!veiculosRes.ok) {
      console.error('Fetch veiculos failed:', veiculosRes.status, await veiculosRes.text());
      return;
    }

    const data = await veiculosRes.json();
    console.log('Veiculos fetched successfully. Count:', data.length);
    console.log('First item:', data[0]);

  } catch (error) {
    console.error('Error:', error);
  }
}

testApi();
