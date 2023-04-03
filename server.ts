import { Application, Router, helpers } from 'https://deno.land/x/oak/mod.ts';
import { oakCors } from 'https://deno.land/x/cors/mod.ts';
import * as base64 from 'https://denopkg.com/chiefbiiko/base64/mod.ts';

const client_id = Deno.env.get('CLIENT_ID');
const client_secret = Deno.env.get('CLIENT_SECRET');

const port: number = +(Deno.env.get('PORT') || 3000);
const url = Deno.env.get('URL') || `http://localhost:${port}`;
const redirect_uri = `${url}/callback/`;

const temporaryList = new Map();

const router = new Router();

router.get('/account/:id', function (ctx) {
  const currentTimestamp = parseInt(
    (new Date().getTime() / 1000).toFixed(0),
    10
  );

  const state = temporaryList.get(ctx.params.id);

  if (state) {
    for (const [key, value] of temporaryList) {
      if (currentTimestamp - value.date > 60) {
        temporaryList.delete(key);
      }
    }
    if (!state.data.access_token) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: true,
      };
    } else {
      temporaryList.delete(ctx.params.id);
      ctx.response.body = state.data;
    }
  } else {
    ctx.response.body = {
      waiting: true,
    };
  }
});

router.get('/callback', async function (ctx) {
  const query = helpers.getQuery(ctx);
  const code = query.code || '';
  const state = query.state || '';

  if (state === null) {
    ctx.response.status = 400;
    ctx.response.body = {
      error: true,
    };
  } else {
    try {
      const params = new URLSearchParams();
      params.append('code', code);
      params.append('redirect_uri', redirect_uri);
      params.append('grant_type', 'authorization_code');

      const token: { access_token: string; refresh_token: string } = await (
        await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          body: params.toString(),
          mode: 'cors',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization:
              'Basic ' +
              base64.fromUint8Array(
                new TextEncoder().encode(client_id + ':' + client_secret)
              ),
          },
        })
      ).json();

      const access_token = token.access_token;
      const refresh_token = token.refresh_token;

      try {
        const user = await (
          await fetch('https://api.spotify.com/v1/me', {
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + access_token,
            },
          })
        ).json();

        temporaryList.set(state, {
          data: {
            ...user,
            access_token,
            refresh_token,
          },
          date: parseInt((new Date().getTime() / 1000).toFixed(0), 10),
        });

        ctx.response.type = 'html';
        ctx.response.body = `<!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width">
          <title>Fyfill</title>
          <style>body,html {font-family: sans-serif;justify-content: center; text-align:center; font-size: 28px; display: flex;height: 100%;}
            #info {align-self: center;}</style>
        </head>
        <body>
          <div id="info">Successfully logged in!<br />Please go back to figma.</div>
          <script>(function() {
            const params = (new URL(document.location)).searchParams;
            if(params.get("error") !== null) {
              document.querySelector('#info').innerHTML = 'There was an error :(';
            }
            globalThis.close();
          })();</script>
        </body>
        </html>`;
      } catch (e) {
        throw new Error(e);
      }
    } catch {
      ctx.response.status = 400;
      ctx.response.body = {
        error: true,
      };
    }
  }
});

router.get('/refresh_token', async function (ctx) {
  try {
    const query = helpers.getQuery(ctx);
    const refresh_token = query.refresh_token;

    const params = new URLSearchParams();
    params.append('refresh_token', refresh_token);
    params.append('grant_type', 'refresh_token');

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      body: params.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization:
          'Basic ' +
          base64.fromUint8Array(
            new TextEncoder().encode(client_id + ':' + client_secret)
          ),
      },
    });

    ctx.response.body = {
      access_token: (await response.json()).access_token,
    };
  } catch {
    ctx.response.status = 400;
    ctx.response.body = {
      error: true,
    };
  }
});

const app = new Application();

app.use(oakCors());
app.use(router.routes());

console.log('Server: ', url);
await app.listen({ port });
