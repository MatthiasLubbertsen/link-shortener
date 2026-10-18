import { renderToStaticMarkup } from "react-dom/server";
import { getRandomNotFoundMessage, getRandomQuote } from "#/lib/quotes";

// Rendered straight from the redirect handler, which sits outside the app's
// router and stylesheet, so the page carries its own styles (same palette as
// the rest of the app).
const css = `
  *{box-sizing:border-box}
  body{margin:0;background:#171717;color:#fff;font-family:"JetBrains Mono Variable","JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
  main{max-width:28rem;margin:0 auto;padding:2rem;text-align:center}
  .card{padding:1.25rem 1rem}
  .code{font-size:2.5rem;font-weight:700;line-height:1;margin:0}
  h1{font-size:14px;margin:.5rem 0 0}
  .msg{margin:.5rem 0 0;font-size:12px;color:#a3a3a3}
  .path{margin:1rem 0 0;font-size:12px;color:#fcd34d;word-break:break-all}
  ul{margin:1rem 0 0;padding:0;list-style:none;text-align:left;font-size:12px;color:#a3a3a3;border-top:1px solid #404040}
  li{padding:.5rem 0;border-bottom:1px solid #404040}
  li:before{content:"> ";color:#737373}
  a{color:#fcd34d;text-decoration:none;font-size:12px}
  a:hover,a:focus{background:#fcd34d;color:#000;outline:none}
  .home{display:inline-block;margin-top:1rem}
  .quote{margin:1rem 0 0;font-size:12px;color:#525252}
`;

function NotFoundTemplate({ host, path }: { host: string; path: string }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="robots" content="noindex" />
        <title>link not found - link shortener</title>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        <main>
          <div className="card">
            <p className="code">404</p>
            <h1>link not found</h1>
            <p className="msg">{getRandomNotFoundMessage()}</p>
            {path && (
              <p className="path">
                {host}/{path}
              </p>
            )}
            <ul>
              <li>
                check the spelling. capitals don't matter, but dashes and
                underscores do.
              </li>
              <li>
                chat apps sometimes add a trailing dot or bracket to links. try
                without it.
              </li>
              <li>the link may have been changed or deleted by its owner.</li>
              <li>still stuck? ask whoever sent it to you.</li>
            </ul>
            <a className="home" href="/">
              [home]
            </a>
          </div>
          <p className="quote">{getRandomQuote()}</p>
        </main>
      </body>
    </html>
  );
}

export function notFoundResponse(host: string, path = "") {
  const html = renderToStaticMarkup(NotFoundTemplate({ host, path }));
  return new Response(`<!DOCTYPE html>${html}`, {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
