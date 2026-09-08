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
   - `ADMIN_CODE` — kodi i veçantë (ndryshe nga `INVITE_CODE`) që
     përdoret vetëm një herë, për të krijuar llogarinë tënde të
     administratorit te `/admin-login/` (tab "Krijo llogari"). Mbaje
     të fshehtë — kushdo me këtë kod merr akses të plotë redaktimi.
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

## Paneli i Administratorit (përmbajtje dinamike, pa deploy)

Që nga kjo version, përmbajtja e moduleve dhe prezantimet PPT jetojnë në
Netlify Blobs (i njëjti sistem ruajtjeje që përdoret për llogaritë e
studentëve), jo më vetëm si skedarë statikë HTML të gjeneruar nga
`build_html.py`. Kjo do të thotë: redaktimi i tekstit të një moduli ose
zëvendësimi i një prezantimi PPT nga paneli i administratorit shfaqet
menjëherë në sit, **pa git commit dhe pa Netlify deploy**.

**Si funksionon:**
- `/course/<kurs>/modul-<N>/` dhe `/course/<kurs>/modul-<N>/slides/`
  renderohen dinamikisht nga Edge Function-i (`auth-gate.js` →
  `_render.js`), duke lexuar nga Blobs. Nëse një modul nuk ka ende
  përmbajtje në Blobs, faqja bie mbrapa (fallback) te skedari statik
  ekzistues (nëse ka) — kjo mban punën ekzistuese si rrjet sigurie
  gjatë kalimit.
- Paneli: `/admin-login/` (identifikim/regjistrim admin) →
  `/admin/` (lista e moduleve) → `/admin/edit/?course=...&modnum=...`
  (redaktor blloqesh — të njëjtin skemë si `modules_data.json`) →
  `/admin/slides/?course=...&modnum=...` (menaxhues prezantimesh:
  shto, fshi, ose zëvendëso krejt dekun).
- **Hapi i parë**, pasi të kesh vendosur `ADMIN_CODE` dhe të kesh
  krijuar llogarinë tënde administratori: hap `/admin/` dhe kliko
  "Importo Modulet" — kjo kopjon të 10 modulet ekzistuese nga
  `modules_data.json` (i paketuar në deploy) te Blobs, një herë. Nuk
  fshin/mbishkruan asgjë që ekziston tashmë — e sigurt për ta rifutur.
- `/admin/users/` — menaxhimi i llogarive: shiko listën e të gjithë
  studentëve/administratorëve, ndrysho rolin (student ↔ admin),
  rivendos fjalëkalimin e dikujt (nuk ka email automatik për "harrova
  fjalëkalimin" — kjo është rruga aktuale kur dikush mbetet jashtë),
  ose fshi një llogari. E vetmja mbrojtje e integruar: nuk lejohet të
  fshihet ose të hiqet roli i të vetmit administrator që ka mbetur, as
  fshirja e llogarisë me të cilën je vetë i identifikuar.

**Migrimi i prezantimeve ekzistuese (p.sh. Moduli 7, i ngarkuar si
skedarë statikë përpara panelit):** te `/admin/slides/?course=...&
modnum=...`, butoni "Migro nga skedarët statikë ekzistues" i merr
rrëshqitjet nga adresa aktuale statike (`/course/.../modul-N/slides/
slide-01.jpg`, etj.) dhe i ngarkon te Blobs përmes të njëjtit endpoint
si ngarkimi normal — nuk fshin origjinalet, thjesht i kopjon.

**Kufizim i rëndësishëm — prezantimet PPT:** Netlify Functions/Edge
Functions nuk kanë LibreOffice, kështu që konvertimi automatik
pptx → imazhe **nuk mund të ndodhë vetë në panel**. Paneli i
administratorit pranon **imazhe të gatshme** (JPG/PNG, të eksportuara
vetë nga PowerPoint: File → Export → Change File Type → JPEG/PNG,
"All Slides"), jo skedarin .pptx direkt. Nëse në të ardhmen duhet
ngarkim i vetë .pptx me konvertim automatik, kjo kërkon një shërbim
të jashtëm konvertimi (p.sh. CloudConvert) me kosto/regjistrim të
veçantë — nuk është ndërtuar ende.

## Struktura e skedarëve

```
content/                       <- publikohet nga Netlify
  index.html                   <- hyrje/regjistrim (email+fjalëkalim+kod)
  admin-login/index.html       <- hyrje/regjistrim admin (ADMIN_CODE)
  admin/
    index.html                 <- paneli: lista e moduleve + import fillestar
    edit/index.html            <- redaktor blloqesh për një modul
    slides/index.html          <- menaxhues prezantimesh (ngarko/fshi/zëvendëso)
  css/style.css
  js/auth-gate.js               <- ekrani i kursit: email, watermark, dil, ndrysho fjalëkalim
  js/toc-scrollspy.js           <- theksimi i seksionit aktual në "Përmbajtja"
  course/
    index.html
    kontabilist-ligjor/modul-1/index.html   <- rezervë statike (fallback)
    ...
netlify/
  functions/
    signup.js                   <- POST /api/signup (student)
    admin-signup.js             <- POST /api/admin-signup (ADMIN_CODE)
    login.js                    <- POST /api/login (student ose admin)
    logout.js                   <- POST /api/logout
    change-password.js          <- POST /api/change-password
    admin-seed-content.js       <- POST /api/admin-seed-content (import fillestar)
    admin-list-modules.js       <- GET /api/admin-list-modules
    admin-get-module.js         <- GET /api/admin-get-module
    admin-save-module.js        <- POST /api/admin-save-module
    admin-upload-slide.js       <- POST /api/admin-upload-slide
    admin-delete-slides.js      <- POST /api/admin-delete-slides
    admin-list-users.js         <- GET /api/admin-list-users
    admin-delete-user.js        <- POST /api/admin-delete-user
    admin-set-role.js           <- POST /api/admin-set-role
    admin-reset-password.js     <- POST /api/admin-reset-password
    list-slides.js              <- GET /api/list-slides (student + admin)
    slide-image.js              <- GET /api/slide-image (stream imazhi)
    _session.js                 <- krijim/verifikim i tokenit të sesionit (i përbashkët)
    _password.js                <- hash/verifikim i fjalëkalimit (i përbashkët)
    _admin_auth.js               <- verifikim sesioni/roli për Functions admin
  edge-functions/
    auth-gate.js                <- mbron /course/* dhe /admin/*; renderim dinamik
    _render.js                   <- gjenerimi HTML nga Blobs (të njëjtën skemë si build_html.py)
netlify.toml                    <- konfigurimi (publish dir, functions dir, /api/* → functions)
package.json                    <- varësia @netlify/blobs
```
