# Plan de réécriture — Bips.xyz v4 (AdonisJS 7 + Flow)

> **But du document.** Plan détaillé destiné à être consommé par un agent utilisant
> le skill **Flow** d'AdonisJS Plus. Il fournit le _brief produit_ global et un
> _découpage en phases_. L'agent fait passer **chaque phase** dans le cycle Flow
> (`brief → blueprint → assert → code`), une à la fois, avec validation entre chaque.

---

## 0. Comment utiliser ce plan avec Flow

1. **Phase 0 d'abord** : créer l'app et **installer les packages** (section 2). Flow
   charge ses cookbooks en fonction des versions installées — donc on installe avant
   de planifier les features.
2. Pour **chaque phase** de la section 5 : donner le bloc de la phase à Flow comme
   intention. Flow produit son `brief/blueprint/assert`, on valide, il code.
3. **Ne pas tout balancer d'un coup.** Respecter l'ordre des phases (dépendances).
4. **Ce que Flow connaît déjà** (conventions Adonis, controllers, services, validators,
   migrations, queue, **tests**) → laissé volontairement haut-niveau.
   **Ce que Flow ne connaît pas** (Pandoc, Meilisearch, logique de parsing/liens) →
   spécifié en détail.

> **Tests : pas spécifiés ici.** Le volet _assert_ (tests unitaires/fonctionnels) est
> produit par Flow lui-même à chaque feature. Ce plan ne décrit donc que l'objectif
> (_brief_) et la conception (_blueprint_).

---

## Workflow git & livraison

**Branche dédiée.** Tout le travail de réécriture se fait sur **`v4-rewrite`**, branchée
depuis `master`. À la fin (toutes les phases passées), **une seule PR** mergera la branche
dans `master`. Pas de PR intermédiaires, pas de merge en cours de route.

**Convention de commit (obligatoire).** Format **`type(scope): description courte`**.

- **type** : `feat`, `fix`, `chore`, `docs`, `refactor`, `style`, `build`, `ci`
- **scope** : ≤ 10 caractères, lié à la phase ou au sujet
  (`scaffold`, `config`, `db`, `ingest`, `pandoc`, `links`, `queue`, `meili`,
  `views`, `front`, `seo`, `docker`, `lint`…)
- **description** : impérative, minuscules, **ligne unique courte** (~50 car. max au total)
- **pas de corps, pas de trailers** (pas de `Co-Authored-By:`, pas de description longue)

Exemples valides (chacun ≤ 50 caractères) :

```
chore(scaffold): adonisjs v7 hypermedia kit
feat(config): typed multi-project config
feat(db): documents and document_links tables
feat(ingest): octokit-based github service
feat(pandoc): mediawiki and markdown to html
feat(links): related specs extraction
feat(queue): sync project job
feat(meili): index documents on sync
feat(views): related specs section
feat(front): themed scss from project config
feat(seo): sitemap for all projects
feat(docker): app and meilisearch compose
```

**Cadence.** Un commit par sous-étape logique d'une phase (1 commit pour le scaffold,
plusieurs pour les grosses phases). **Pas de squash en cours de route** — l'historique
reste lisible jusqu'à la PR finale.

**PR finale.** Titre au même format (`feat(v4): adonisjs 7 multi-project rewrite`),
description résumant les phases livrées + DoD cochée (section 8).

---

## 1. Brief produit (vision globale)

**Quoi.** Un site miroir, rapide et partageable, de dépôts de specs hébergés sur GitHub.
Aujourd'hui deux projets : **BIPs** (Bitcoin, `bitcoin/bips`) et **NIPs** (Nostr,
`nostr-protocol/nips`). Demain : **n'importe quel autre projet**, ajouté via une simple
entrée de configuration.

**Pourquoi.** Partager `bips.xyz/118` au lieu d'une longue URL GitHub `.mediawiki`,
avec une lecture propre, une recherche performante, et les specs liées entre elles.

**Parcours utilisateur.**

- Arrive sur le domaine d'un projet → **page d'index** : liste/tableau de toutes les specs.
- Clique sur une spec → **page de lecture** : titre, sommaire (TOC), contenu rendu,
  et **les specs en relation** (nouveau).
- Tape une recherche → **résultats** (titre / auteurs / contenu), filtrables par facettes.
- Pages annexes : **support** (don Lightning), `robots.txt`, `sitemap.xml`.

**Exigences fortes (non négociables, voir Definition of Done) :**

- **Démarrage instantané** : l'app sert immédiatement les données présentes en base,
  **même si une synchro est en cours ou si la base est vide**. Plus jamais de boot bloqué.
- **Ajouter un projet = ajouter une entrée de config** (+ éventuellement un logo/couleur),
  sans toucher au reste du code.
- **Rendu le plus rapide possible** (HTML pré-rendu + cache).

---

## 2. Stack & conventions imposées

| Brique               | Choix                                           | Notes                                                |
| -------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| Framework            | **AdonisJS 7**                                  | Node.js **24+**, `ts-exec` (plus de `ts-node`)       |
| Rendu                | **Edge** (+ HTML mis en cache)                  | Pas d'Inertia/React. Starter _Hypermedia_.           |
| ORM / base           | **Lucid + SQLite**                              | **Source de vérité.** Survit aux redémarrages.       |
| Synchro / jobs       | **`@adonisjs/queue`** (driver **Database**)     | Pas de Redis. Retries + scheduling.                  |
| Ingestion GitHub     | **`@octokit/rest`** (API officielle)            | Clé `GITHUB_API_KEY` requise. Remplace le fork ungh. |
| Conversion           | **Pandoc** (binaire système)                    | mediawiki + markdown → HTML, **à la synchro**.       |
| Recherche            | **Meilisearch** (client officiel `meilisearch`) | Service séparé. Facettes.                            |
| Assets               | **Vite + SCSS**                                 | Thème piloté par la config projet.                   |
| Markdown (optionnel) | `edge-markdown` / `@adonisjs/content`           | Voir notes ci-dessous.                               |

**Packages à installer en Phase 0** (pour que Flow charge les bons cookbooks) :
`@adonisjs/lucid`, `@adonisjs/queue`, `edge`, `@adonisjs/vite`,
`meilisearch` (client officiel), `@octokit/rest` (API GitHub), `cheerio` (post-traitement HTML).
**Pandoc** = binaire système (image Docker), **pas un package npm**.

> ⚠️ **Hors connaissance de Flow.** Meilisearch et Pandoc ne sont pas des packages
> Adonis : aucun cookbook. Ils sont donc spécifiés en détail aux phases 3 et 6.

**Évolutions clés vs v3.** Deux dépendances fragiles disparaissent :

- le _hack GitHub Gist_ (rendu mediawiki) → remplacé par **Pandoc** ;
- le **fork maison d'ungh** → ungh a **supprimé la route de contenu des fichiers** (d'où le
  fork + clé). On lit désormais les dépôts directement via l'**API GitHub officielle
  (`@octokit/rest`)**.

Une **`GITHUB_API_KEY` reste donc nécessaire** (lecture authentifiée, ~5000 req/h), mais pour
un usage standard, **sans proxy à maintenir**. ⚠️ La clé est un **vrai secret** : jamais
commitée, et **révoquer le token v3** qui traînait dans `.env`.

**À NE PAS reproduire de la v3** (corrections attendues, cf. section 7) : layout dupliqué

- référence morte à `app.js`, bug du `{{appUrl}}` dans un template-string, `node-cron`
  dans le framework, validator mal nommé, indentation incohérente.

---

## 3. Configuration multi-projets (cœur du système)

Un module de config **typé et validé** (schéma VineJS) décrivant un tableau de projets.

```ts
// config/projects.ts (forme cible — l'agent l'idiomatise)
interface ProjectConfig {
  key: string // 'bips' | 'nips' | …  (identifiant interne + clé d'index)
  name: string // 'BIPs'
  tagline: string // 'bitcoin improvement proposals'
  domain: string // 'bips.xyz'  (routage par .domain())
  color: string // '#ff9500'   (thème SCSS, voir phase 7)
  logo: string // chemin/clé d'icône
  repo: { owner: string; repo: string; branch?: string } // 'bitcoin'/'bips'
  formats: ('mediawiki' | 'markdown')[] // bips: les deux ; nips: ['markdown']
  numberBase: 10 | 16 // bips: 10 ; nips: 16 (numéros hex)  → contrainte de route + tri
  filePattern: string // regex des fichiers de spec (ex: 'bip-([0-9]+)\.(mediawiki|md)')
  homeFile?: string // ex nips: 'README.md' rend la page d'accueil
  analyticsId?: string // Umami (prod)
  enabled: boolean
}
```

**Routage dynamique.** Au boot, on boucle sur les projets `enabled` et on génère pour
chacun un `router.group(...).domain(project.domain)` avec : `/`, `/search`, `/:number`
(contrainte de route dérivée de `numberBase` : `[0-9]` ou `[0-9a-fA-F]`), `/support`,
`/robots.txt`. Un middleware « projet courant » résout le `ProjectConfig` à partir du
domaine et le partage à la vue (couleur, logo, nom, `lastUpdate`).

---

## 4. Modèle de données (Lucid)

**`documents`**

- `id` (pk)
- `project` (string, = `ProjectConfig.key`) — indexé
- `number` (string) — numéro canonique **sans zéros de tête** (gère bips déc. et nips hex)
- `sort_order` (int) — `parseInt(number, numberBase)`, calculé à l'ingestion (tri propre)
- `title` (string)
- `authors` (json / string[])
- `status`, `type`, `layer`, `created` (strings, nullable — surtout BIPs)
- `source_format` ('mediawiki' | 'markdown')
- `source_url` (string) — lien vers le fichier GitHub d'origine
- `content_html` (text) — HTML **pré-rendu** (Pandoc + post-traitement)
- `content_text` (text) — texte seul (pour extraits + index Meilisearch)
- `toc` (text, nullable) — sommaire HTML
- `hash` (string) — sha du blob source (diff de synchro)
- `created_at`, `updated_at`
- **Unique (`project`, `number`).**

**`document_links`** (graphe de relations, auto-relation many-to-many)

- `id`, `from_document_id` (fk), `to_document_id` (fk), `created_at`
- **Unique (`from_document_id`, `to_document_id`).**
- Permet : liens **sortants** (cette spec cite X) **et entrants** (« référencée par »).

**`project_meta`** (ou table clé/valeur légère)

- `project` (pk), `last_update` (datetime), `home_html` (text, nullable — page d'accueil
  type README des NIPs).

**Relations Lucid.** `Document.relatedOut` / `Document.relatedIn` via `document_links`.

---

## 5. Découpage en phases (à faire passer une par une dans Flow)

> Format de chaque phase : **Objectif** (= brief) et **Conception** (= blueprint).
> Le volet tests (_assert_) est généré par Flow lui-même → non spécifié ici.
> Garder l'ordre (dépendances).

### Phase 0 — Scaffold & configuration

- **Objectif** : app Adonis 7 (Edge, Vite, Lucid+SQLite) qui démarre, + système de
  config multi-projets + routage dynamique par domaine.
- **Conception** : starter Hypermedia ; schéma d'env (`APP_URL`, `PORT`, `HOST`, DB path,
  `MEILISEARCH_HOST`, `MEILISEARCH_API_KEY`, **`GITHUB_API_KEY`** ; plus de `UNGH_URL`) ;
  `config/projects.ts` (section 3) ; middleware « projet courant » ; routes générées en boucle.
  Respecter la préférence env : `HOST=0.0.0.0`.

### Phase 1 — Modèle de données & migrations

- **Objectif** : tables `documents`, `document_links`, `project_meta` + modèles + relations.
- **Conception** : section 4. Normalisation du `number` (strip zéros de tête), `sort_order`.

### Phase 2 — Ingestion GitHub (service, via Octokit)

- **Objectif** : lister + récupérer les fichiers de spec d'un projet depuis l'**API GitHub
  officielle**, parser les métadonnées, sans rien convertir encore.
- **Conception** (logique métier, détailler) :
  - `GithubService` basé sur **`@octokit/rest`** (auth `GITHUB_API_KEY`).
  - **Lister les fichiers** via la Git Trees API :
    `octokit.git.getTree({ owner, repo, tree_sha: branch, recursive: '1' })` → `{ path, sha }`
    pour chaque blob.
  - Filtrer via `ProjectConfig.filePattern` ; extraire le `number` (canonique).
  - **Diff par hash** : si `document.hash === blob.sha`, on **saute** (aucune requête de contenu).
  - **Contenu des fichiers modifiés** via la Blob API
    `octokit.git.getBlob({ owner, repo, file_sha: sha })` → décoder le **base64**
    (évite la limite 1 Mo de l'API _contents_). Gérer le rate limit (5000 req/h authentifié).
  - **Parsing du préambule** :
    - _mediawiki_ : bloc entre `<pre>` et `</pre>`.
    - _markdown_ : premier bloc ` ` ```.
    - Lignes `Clé: valeur` → `Title`, `Author`, `Status`, `Type`, `Layer`, `Created`
      (gérer les valeurs multi-lignes, comme la v3). `authors` = split sur `,` en retirant
      les `<email>`.
  - _NIPs_ : `homeFile` (README) → `project_meta.home_html` (après conversion phase 3) ;
    titre NIP = `# h1` + `## h2`.

### Phase 3 — Conversion (Pandoc) _(hors cookbook Flow — spécifier)_

- **Objectif** : convertir le contenu source en HTML propre, **à la synchro**.
- **Conception** :
  - `PandocService` : `child_process` (spawn), `from = mediawiki|markdown`, `to = html`,
    **timeout** + gestion d'erreurs (ne pas faire planter toute la synchro pour un fichier).
  - **Coloration syntaxique** : soit `--highlight-style` de Pandoc, soit Shiki à la synchro
    (thème `one-dark-pro` comme v3). Choisir Shiki si on veut le même rendu qu'avant.
  - **Post-traitement HTML** (porter la logique v3, via `cheerio`/regex) :
    - réécrire les liens internes `bip-0001.mediawiki` / `01.md` → `/1` (selon `numberBase`),
    - ajouter le lien **« source »** vers le fichier GitHub d'origine dans le préambule,
    - normaliser les `id=` d'ancres et les liens du sommaire (lowercase, `_`→`-`),
    - réécrire les URLs d'images vers `raw.githubusercontent.com/...`.
  - Produire `content_text` (texte seul, `cheerio(...).text()`) pour extraits + recherche.

### Phase 4 — Extraction des liens & specs en relation _(feature clé)_

- **Objectif** : sur la page d'une spec, afficher les specs **en relation**.
- **Conception** :
  - À la synchro, après conversion : scanner le HTML/texte pour les références internes
    (liens `/(\d+)` ou `bip-0*(\d+)` / `nip` hex selon `numberBase`).
  - Résoudre vers les `number` **connus du même projet**, dédupliquer, **persister les arêtes**
    dans `document_links` (sortantes). Les entrantes se déduisent par requête inverse.
  - Page de lecture : section « En relation » (sortantes ; option : « Référencé par » entrantes).

### Phase 5 — Synchro orchestrée par la queue _(découplée du boot)_

- **Objectif** : enchaîner fetch → convert → liens → persistance → réindex Meilisearch →
  `last_update`, **hors du chemin de boot et de requête**, avec planification.
- **Conception** :
  - `@adonisjs/queue` (driver Database). Job **`SyncProjectJob(projectKey)`** orchestrant
    les phases 2→4 + réindex (phase 6) + `project_meta.last_update`.
  - **Planification récurrente** (ex. quotidienne) via la queue (plus de `node-cron`).
  - **Worker en process séparé** (`node ace queue:work`) → une synchro longue ne bloque
    jamais le HTTP.
  - **Boot** : n'attend **aucune** synchro. Au 1er démarrage avec base vide → l'app répond
    quand même (état « synchronisation en cours » propre).
  - **Commande ace `sync:run [project]`** : déclenche/force une synchro à la main (1er déploiement, debug).

### Phase 6 — Recherche Meilisearch _(hors cookbook Flow — spécifier)_

- **Objectif** : recherche rapide, tolérante aux fautes, avec facettes, par projet.
- **Conception** :
  - `MeilisearchService` (client officiel `meilisearch`, host + key via env).
  - **Index unique `documents`** ; `filterableAttributes = [project, status, type, layer]` ;
    `searchableAttributes = [title, authors, content_text]` (titre prioritaire dans le ranking).
  - **Réindex à la synchro** (appelé par `SyncProjectJob`).
  - **Recherche par domaine** : filtre `project = <clé du projet courant>`.
  - Controller `search` : `q` (min 3, validé) → résultats + **highlighting** + extrait (~1000 car.) ;
    **négociation de contenu** HTML/JSON (comme v3) ; facettes exposables.

### Phase 7 — Rendu, pages & cache (Edge)

- **Objectif** : pages rapides, thématisées par projet, mises en cache.
- **Conception** :
  - **Un seul layout paramétré** (couleur/logo/nom depuis le `ProjectConfig`) — **pas** de
    duplication par projet (corrige la v3).
  - Pages : **index** (tableau des specs, tri par `sort_order`), **lecture** (titre + TOC +
    `content_html` + **specs en relation**), **search**, **support**, `robots.txt`.
  - **Cache HTTP** : `Cache-Control` + `ETag` basé sur `hash`/`updated_at`. Le contenu ne
    change qu'à la synchro → on peut cacher agressivement. Option : cache de page rendue
    (clé `project:number:hash`) — invalidation naturelle quand le hash change.

### Phase 8 — Front (SCSS thématisé + Vite)

- **Objectif** : thème dérivé de la couleur du projet, sans duplication.
- **Conception** : variables SCSS/CSS **injectées depuis la config** (couleur principale +
  dérivées) au lieu d'un fichier de variables par projet ; entrypoints Vite ; JS minimal ;
  polices + icônes (bitcoin, nostr, search, anchor). Porter les styles v3 (tables, code, footer).

### Phase 9 — Sitemap, analytics & support

- **Objectif** : SEO + dons.
- **Conception** :
  - **Sitemap pour TOUS les projets** (corrige la v3 où les NIPs étaient désactivés),
    régénéré à la synchro.
  - **Umami** en prod (id par projet via `ProjectConfig.analyticsId`).
  - Page **support** (widget Lightning) ; garder le bloc « mirror of … » + « Source code ».

### Phase 10 — Déploiement (Docker)

- **Objectif** : image reproductible avec toutes les dépendances externes.
- **Conception** :
  - **Dockerfile** : Node 24 + **binaire Pandoc** installé.
  - **docker-compose** : service `app` + service `meilisearch` + **volume** pour le fichier SQLite.
  - Pipeline : `ace build` → migrations → **synchro initiale non bloquante** (job ou `sync:run`)
    → démarrage `app` (web) + `worker` (`queue:work`).

### Phase 11 — Qualité

- **Objectif** : robustesse et cohérence.
- **Conception** : lint + format (config Adonis), `typecheck` ; corriger les points de la section 7.

---

## 6. Briques hors connaissance de Flow (rappel)

Flow n'a **pas de cookbook** pour ces deux briques → suivre les specs détaillées des phases :

- **Pandoc** → Phase 3 (child_process, timeout, post-traitement, coloration).
- **Meilisearch** → Phase 6 (index unique, attributs filtrables/recherchables, réindex à la synchro).

---

## 7. Améliorations / corrections vs v3 (à intégrer)

- **`GITHUB_API_KEY` traitée comme un vrai secret** : env non commité, et **révoquer le token v3**
  qui a fuité dans `.env`. Ingestion via l'**API GitHub officielle (Octokit)** — plus de fork ungh à maintenir.
- **Layout unique paramétré** ; supprimer `layout-nips.edge` dupliqué + la référence morte à `app.js`.
- Corriger le **bug `{{appUrl}}`** interpolé dans un template-string (descriptions de pages).
- **Validator** renommé générique (`searchValidator`, plus `searchBipsValidator`).
- **Plus de `node-cron`** dans le framework → planification via la queue.
- **Sitemap NIPs réactivé** (tous projets).
- **Indentation/format cohérents** (lint).
- Conserver les correctifs récents : numéros **zéro-paddés** et **hex** gérés à l'ingestion.

---

## 8. Definition of Done (critères de validation)

- [ ] L'app **démarre instantanément**, base vide incluse — **aucun boot bloqué** par la synchro.
- [ ] **Ajouter un projet = une entrée de config** (+ logo/couleur), zéro autre changement de code.
- [ ] `bips.xyz/118` (et équivalent NIP hex) rend vite, **HTML servi depuis le cache**.
- [ ] La page d'une spec affiche ses **specs en relation**.
- [ ] Recherche via **Meilisearch** fonctionnelle, avec **facettes** et négociation HTML/JSON.
- [ ] Synchro = **job en queue**, planifiée, relançable via `ace sync:run`, worker séparé.
- [ ] **Ingestion via l'API GitHub officielle (Octokit)** ; **Pandoc** convertit mediawiki + markdown — plus de hack Gist ni de fork ungh.
- [ ] `lint` + `typecheck` propres.
- [ ] **Docker compose** lève app + Meilisearch + Pandoc, SQLite persisté en volume.

```

```
