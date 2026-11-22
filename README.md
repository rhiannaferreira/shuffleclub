# Shuffle Club

Ten card games on one table: Speed, Texas Hold'em, Ratscrew, Six-Card Golf, Gin Rummy, Klondike, Blackjack, Crazy Eights, War and Memory.

**Play:** https://shuffleclub.vercel.app

## Install it on your phone

- **iPhone / iPad (Safari):** open the link, tap Share, then Add to Home Screen.
- **Android (Chrome):** open the link and tap Install on the ticket under the games, or use the menu's Install app.
- **Desktop (Chrome / Edge):** click the install icon in the address bar.

Once installed it opens full screen and works offline. Online Speed still needs a connection.

## Online Speed

One player taps **Host a table** and gets a 4-letter code; the other joins with it. The two devices connect directly (WebRTC through [PeerJS](https://peerjs.com)), and the host's device runs the game. There is no game server to keep running.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | The whole game: styles, rules and every table |
| `js/net.js` | Online tables (host/guest connection over PeerJS) |
| `vendor/peerjs.min.js` | PeerJS 1.5.4 client, MIT licence |
| `sw.js` | Offline cache. Bump `VERSION` when you ship changes |
| `manifest.webmanifest`, `icons/` | Home-screen name, colours and icons |

## Run it locally

No build step. Serve the folder and open it:

```sh
python3 -m http.server 8080
```

Pushes to `main` deploy to Vercel automatically.
