# Registre de recherche — lot du 7 octobre 2026

Vérification : 7 octobre 2026 à 18 h 23 UTC / 19 h 23 à Douala. Fenêtre maximale : 72 heures depuis la **publication originale de la source**. Le fichier public contient six sujets distincts. La date de notre article et celle de sa source sont séparées ; un nouveau passage de veille ne rajeunit jamais un article.

## Sources retenues et preuve de date

Les timestamps ci-dessous viennent de `article:published_time` dans le HTML original récupéré en direct avec `Invoke-WebRequest`. Pour ONE et MMA Fighting, `datePublished` dans le JSON-LD confirme également la date. Les offsets ont été convertis en UTC sans changer l'instant de publication.

| Sujet | Publication originale UTC | Source originale | Nature de la nouveauté |
| --- | --- | --- | --- |
| Réponse de Natalia Silva | 2026-10-07T15:00:00Z | [Entretien MMA Fighting](https://www.mmafighting.com/ufc/514585/natalia-silva-claps-back-at-valentina-shevchenko-after-winning-ufc-title-tells-her-to-get-in-line) | Nouvel entretien ; le résultat du 3 octobre reste du contexte. |
| Ajouts à ONE SAMURAI 4 | 2026-10-07T11:05:27Z | [Annonce ONE Championship](https://www.onefc.com/news/stacked-one-samurai-4-lineup-bolstered-by-trio-of-riveting-all-japan-matchups/) | Deux nouvelles affiches de MMA confirmées ; le grappling est identifié séparément. |
| DWCS, semaine 9 | 2026-10-07T01:05:00Z | [Résultats officiels UFC](https://www.ufc.com/news/dana-whites-contender-series-season-10-week-9-results) | Résultats de l'événement du 6 octobre et contrats. |
| Piste Rakhmonov–Morales | 2026-10-06T18:30:00Z | [Article MMA Fighting](https://www.mmafighting.com/ufc/514458/shavkat-rakhmonov-hints-at-battle-of-undefeateds-for-next-ufc-fight) | Nouveau message rapporté ; interprétation du média explicitement attribuée. |
| Allen–Duncan | 2026-10-05T21:22:25Z | [Avant-combat officiel UFC](https://www.ufc.com/news/ufc-vegas-122-fight-by-fight-preview-allen-vs-duncan) | Avant-combat détaillé pour la soirée à venir du 10 octobre. |
| Réaction d'O'Malley | 2026-10-05T20:00:00Z | [Article MMA Fighting](https://www.mmafighting.com/ufc/514339/sean-omalley-likes-payton-talbott-callout-but-denies-ducking-fight-he-made-it-up) | Nouvelle réponse ; les intentions sont distinguées d'une affiche confirmée. |

Chaque entrée comporte `sources`, `sourceEvidence`, `sourcePublishedAt`, `publishedAt`, `verifiedAt`, `newsEventDate` et une qualification de la date d'événement. `backgroundEventDate` est distinct de la date du nouveau fait dans les articles de réaction. Les futurs événements utilisent `scheduledEventDate`.

Les extraits courts dans `sourceEvidence` servent au contrôle du passage source. Les articles sont des synthèses originales en français, avec des liens vers le texte consulté. Aucun entretien n'est attribué à Actu MMA ; aucune déclaration traduite n'est inventée. Les six visuels d'actualité sont désormais des photographies ou un montage officiel issus des pages sources. Les légendes distinguent les photographies de contexte ou d'archive de la date du nouveau fait rapporté.

## Contrôles et exclusions

- Le résultat DWCS a été recoupé avec [MMA Fighting](https://www.mmafighting.com/ufc/514497/dwcs-season-10-week-9-results-ufc-employee-sal-everett-earns-ufc-contract-with-brutal-knockout-win). La source officielle prévaut pour les quatre contrats. Des agrégateurs évoquaient cinq contrats ; cette donnée a été rejetée.
- [Gabriel–Rasulov](https://www.onefc.com/news/lucas-gabriel-vs-alibeg-rasulov-set-for-explosive-lightweight-mma-main-event-at-one-fight-night-49/) a été écarté : des reprises datées du 5 octobre renvoyaient à une annonce originale du 3 octobre. La date récente d'une reprise ne constitue pas une nouvelle information.
- L'entretien ONE avec Erdogan du 5 octobre a été consulté mais écarté de ce lot au profit de l'entretien Silva plus récent. Le résultat du 2 octobre ne devait pas devenir un résultat neuf grâce à la date de l'entretien.
- Les hypothèses Rakhmonov–Morales et O'Malley–Talbott ne fournissent aucune date ou salle de combat. Aucun événement n'est créé à partir de ces hypothèses.
- Paramount+ est cité uniquement comme indication américaine de la source officielle. Aucun diffuseur français n'a été déduit de cette information.
- Le HTML de l'UFC était parfois bloqué dans l'outil web ; la récupération HTTP directe a fourni les contenus et métadonnées des deux pages retenues. Les résultats de recherche n'ont pas remplacé cette vérification.

## Quarantaine des anciennes entrées

Les 15 entrées d'origine sont conservées dans `docs/quarantined-articles.json`, hors du jeu de données publié. Elles n'avaient aucune provenance structurée ni timestamp de publication originale. Plusieurs transformaient un titre RSS en texte interchangeable avec des analyses et citations génériques. Elles ne sont donc pas maintenues dans un fil qui promet uniquement de nouvelles informations vérifiées.

La quarantaine est une décision de qualité et de provenance, pas une affirmation que chaque fait ancien était faux. En particulier, la recherche actuelle a confirmé le statut de champion incontesté de Ciryl Gane et l'affiche Gane–Hokit. Leur ancien article présentait la date de publication locale comme fraîcheur de l'information, ce qui ne convient pas à ce lot.

### Correction factuelle importante pour les fiches et le calendrier

Sources directes : [annonce UFC du 20 septembre](https://www.ufc.com/news/gane-hokit-harrison-nunes-headline-ufc-334-new-york-city) et [portrait UFC du 22 septembre](https://www.ufc.com/news/ciryl-gane-undisputed-and-ready-defend-polymarket-ufc-334).

Ces sources confirment une promotion de Gane après que Tom Aspinall a libéré la ceinture. Elles confirment aussi UFC 334 le 14 novembre au Madison Square Garden. Ces annonces anciennes peuvent justifier une fiche ou un calendrier, mais ne sont pas des actualités des 72 dernières heures. La nouvelle rédaction du site ne doit pas les présenter comme un sacre tout juste survenu dans la cage.

## Limites de cette vérification

Ce registre prouve la recherche et la provenance du lot local. Il ne prouve ni publication en production, ni activation d'un cron, ni exécution réussie d'un futur lot. La disponibilité future de six sujets admissibles doit être contrôlée à chaque échéance : la quantité demandée ne justifie ni une date inventée, ni la reprise d'un événement ancien.

## Audit du calendrier et des combattants

Les anciennes cartes sont archivées dans `docs/quarantined-events.json` et les anciennes fiches dans `docs/quarantined-fighter-snapshots.json`. Ces archives sont hors des routes publiques. Les ajouts et suppressions ci-dessous reposent sur une consultation des pages originales le 7 octobre 2026 à 18 h 27 UTC.

- [UFC Allen–Duncan, page officielle](https://www.ufc.com/event/ufc-fight-night-october-10-2026) : 10 octobre, **Meta APEX à Las Vegas**. L'avant-combat du 5 octobre confirme cette salle. Vancouver apparaît dans des historiques de combats d'octobre 2025 ; ce lieu ne concerne pas la nouvelle affiche. La page annonce les préliminaires à 17 h EDT et la carte principale à 20 h EDT, soit les deux instants UTC `2026-10-10T21:00:00Z` et `2026-10-11T00:00:00Z`. Les conversions parisiennes tiennent compte du changement de date. Le compte à rebours utilise le premier instant, puis indique seulement que l'horaire annoncé a été atteint.
- [ONE SAMURAI 4, page officielle](https://www.onefc.com/events/one-samurai-4/) : 17 octobre à l'Ariake Arena de Tokyo. Le calendrier présente une **sélection de trois combats de MMA**, dont les deux annonces nouvelles du 7 octobre. Il ne transforme pas une affiche de kickboxing, muay-thaï ou grappling en combat de MMA. Aucun horaire absolu exploitable n'est affirmé ni transformé en compte à rebours.
- [UFC 334, annonce officielle](https://www.ufc.com/news/gane-hokit-harrison-nunes-headline-ufc-334-new-york-city) : 14 novembre au Madison Square Garden, Gane–Hokit et Harrison–Nunes. La carte affichée est partielle. Les anciens co-combats et horaires précis sans preuve ont été retirés.
- Les fiches UFC utilisent le bilan W–L–D et les statistiques de finitions affichés par les profils officiels, avec la date du relevé et leurs liens. Le no contest de Gane contre Aspinall est distinct d'une défaite ; la victoire de Gane sur Pereira est corrigée en TKO au deuxième round, à 1 min 27 s. Le statut de champion incontesté repose sur l'annonce de septembre, plutôt que sur un badge de profil potentiellement retardataire.
- Les anciens taux de finition, classements et titres sans preuve ne sont plus affichés. Les résultats détaillés constituent une sélection vérifiée, et non un palmarès exhaustif. La page de Parnasse présentait deux temps divergents pour son combat contre Hooker ; le round et la méthode sont conservés sans inventer un temps pour arbitrer cette incohérence.
- [Oumar Kane, profil ONE](https://www.onefc.com/athletes/oumar-kane/) : la nationalité sénégalaise remplace la nationalité française inventée. Sa biographie distingue le titre obtenu en novembre 2024 de sa perte en mai 2026. Le compteur ONE peut mélanger des apparitions sous plusieurs règles et ne prouve pas un bilan professionnel complet de MMA ; les nombres non vérifiés sont retirés.
- Les neuf portraits de fiches ont été remplacés par les photographies de leurs pages officielles UFC ou ONE. Chaque entrée conserve la provenance exacte et un crédit de l'organisation, sans inventer une licence de réutilisation ni un photographe absent de la source. Les biographies ne déduisent pas un programme quotidien d'entraînement ni une future affiche à partir d'un palmarès.

Ces vérifications donnent des instantanés datés. Le lot d'actualités automatisé n'est pas présenté comme un mécanisme de mise à jour automatique des fiches ou des cartes. Les annonces de l'organisation restent accessibles directement à chaque page.

## Photographies des six actualités

`scripts/news-image-fetch.mjs` récupère l'image `og:image` de chaque page originale. Pour Allen–Duncan, la version de plus grande taille du même montage, explicitement présente dans le HTML UFC, est utilisée. Les fichiers sont convertis en WebP 1200 × 675 puis inspectés visuellement. Les portraits et le montage correspondent aux sujets identifiés dans la source, sans remplacement par une image générée.

`imageSource` conserve l'URL exacte de l'image, l'URL sociale d'origine, la page qui l'a publiée, le crédit explicite quand il existe, les dimensions originales et la date de récupération. Natalia Silva : Cooper Neill/Zuffa LLC ; Shozo Isojima : ONE Championship ; Rakhmonov : Steve Marcus/Getty Images ; O'Malley : Nathan Posner/Anadolu via Getty Images. Les deux visuels UFC sont attribués au diffuseur de la page, sans inventer un nom de photographe absent de la source pour ces images précises.

La disponibilité publique d'une image n'est pas une preuve de licence de réutilisation. `rightsStatus` reste `unverified` ; aucune licence ou autorisation n'est affirmée. La récupération et les crédits ne prouvent pas ces droits.
