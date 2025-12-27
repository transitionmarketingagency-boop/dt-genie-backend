import { GoogleAuth } from 'google-auth-library';

async function testAuth() {
  try {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const token = await client.getAccessToken();
    console.log('Access token retrieved successfully:', token);
  } catch (err) {
    console.error('Auth failed:', err);
  }
}

testAuth();
