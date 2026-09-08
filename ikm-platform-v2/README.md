# Platforma "Kontabilist Ligjor" — IKM (v2, hyrje pa Netlify Identity)

Kjo është rindërtim i plotë i sistemit të hyrjes. Netlify Identity është
hequr fare (widget-i i tij ka treguar sjellje jo të qëndrueshme me
tokenat e ftesës/rivendosjes). Në vend të tij:

- Studentët **krijojnë vetë llogarinë** (email + fjalëkalim i zgjedhur
  prej tyre) duke përdorur një **kod ftese** që ti e cakton.
- Fjalëkalimet ruhen vetëm si hash (asnjëherë si tekst i thjeshtë).
- Hyrja te `/course/*` kontrollohet nga një **Edge Function** — kjo
  ndodh në serverin e Netlify, PARA se faqja statike të shërbehet, jo
  vetëm me JavaScript të fshehur.

## Si funksionon

1. **Regjistrimi** (`/api/signup`) — kontrollon kodin e ftesës kundrejt
   ndryshores së mjedisit `INVITE_CODE`, krijon llogarinë (email +
   fjalëkalim i hash-uar) te Netlify Blobs, vendos një cookie sesioni.
2. **Hyrja** (`/api/login`) — kontrollon email + fjalëkalim kundrejt
   hash-it të ruajtur, vendos të njëjtën cookie sesioni.
3. **Edge Function** (`netlify/edge-functions/auth-gate.js`) — kontrollon
   cookie-n e sesionit për çdo kërkesë te `/course/*`; nëse mungon ose
   ka skaduar, ridrejton te faqja e hyrjes.
4. **Ndrysho fjalëkalimin** (`/api/change-password`) — brenda kursit,
   studenti mund ta ndryshojë fjalëkalimin (kërkon fjalëkalimin aktual).
5. **Dalja** (`/api/logout`) — fshin cookie-t e sesionit.

## Hapat për vendosje (deploy)

Netlify Drop (drag-and-drop) **nuk mjafton më** — Functions dhe Edge
Functions kërkojnë një deploy të lidhur me Git.

1. Krijo një repository të ri në GitHub (nëse s'ke, krijo llogari falas
   në github.com) dhe ngarko gjithë këtë folder atje (mund të bëhet
   direkt në browser: "Add file" → "Upload files" te faqja e repos).
2. Në Netlify Dashboard → **Add new site** → **Import an existing
   project** → lidh llogarinë GitHub → zgjidh repository-n.
3. Build settings: Netlify duhet t'i zbulojë vetë nga `netlify.toml`
   (publish = "content", functions = "netlify/functions"). Nuk ka
   nevojë për build command.
4. Site configuration → **Environment variables** → shto:
   - `AUTH_SECRET` — një varg i gjatë e i rastësishëm (p.sh. 40+
     karaktere). Përdoret për të nënshkruar sesionet — mos e ndrysho
     pasi studentët të kenë filluar të hyjnë, përndryshe të gjithë
     do të dalin jashtë njëherësh.
   - `INVITE_CODE` — kodi që u jep studentëve për t'u regjistruar
     (mund ta ndryshosh/rrotullosh kur të duash nga këtu).
5. Deploy. Kaq — `/course/*` tani mbrohet nga Edge Function-i.

## Për të bërë një ndryshim në të ardhmen

Nuk ka më nevojë për zip/redeploy manual: ngarko skedarët e ndryshuar
te GitHub (browser, "Upload files", ose "Edit" direkt te skedari), dhe
Netlify e ribën deploy-in vetë automatikisht.

## Si të shtosh module/kurse të reja

Njësoj si më parë — shih `build_html.py` dhe `extract_modules.py`.
Vetëm kujdes: çdo faqe e re e krijuar nga `build_html.py` duhet të
përfshijë `<script src="/js/auth-gate.js"></script>` te fundi i
`<body>`, që të shfaqet email-i, watermark-u, dhe butonat
Dil/Ndrysho fjalëkalimin — kjo është tashmë e integruar në template.

## Struktura e skedarëve

```
content/                       <- publikohet nga Netlify
  index.html                   <- hyrje/regjistrim (email+fjalëkalim+kod)
  css/style.css
  js/auth-gate.js               <- ekrani i kursit: email, watermark, dil, ndrysho fjalëkalim
  course/
    index.html
    kontabilist-ligjor/modul-1/index.html
    kontabilist-ligjor/modul-2/index.html
netlify/
  functions/
    signup.js                   <- POST /api/signup
    login.js                    <- POST /api/login
    logout.js                   <- POST /api/logout
    change-password.js          <- POST /api/change-password
    _session.js                 <- krijim/verifikim i tokenit të sesionit (i përbashkët)
    _password.js                <- hash/verifikim i fjalëkalimit (i përbashkët)
  edge-functions/
    auth-gate.js                <- mbron /course/* në nivel serveri
netlify.toml                    <- konfigurimi (publish dir, functions dir, /api/* → functions)
package.json                    <- varësia @netlify/blobs
```
