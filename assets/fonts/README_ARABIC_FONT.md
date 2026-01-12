# Instructions pour ajouter une police arabe

## Problème
Si le texte arabe dans les bulletins s'affiche sous forme de petits carrés (□), c'est parce qu'aucune police compatible avec l'arabe n'est disponible.

## Solution

### Option 1 : Télécharger Noto Sans Arabic (Recommandé)

1. Allez sur https://fonts.google.com/noto/specimen/Noto+Sans+Arabic
2. Cliquez sur "Download family"
3. Extrayez le fichier ZIP
4. Copiez les fichiers suivants dans le dossier `backend/assets/fonts/`:
   - `NotoSansArabic-Regular.ttf`
   - `NotoSansArabic-Bold.ttf` (optionnel)

### Option 2 : Utiliser une police système (Windows)

Si vous êtes sur Windows et que Arial Unicode MS est installé, le système devrait la détecter automatiquement.

### Option 3 : Télécharger Amiri (Alternative)

1. Allez sur https://fonts.google.com/specimen/Amiri
2. Téléchargez la police
3. Copiez `Amiri-Regular.ttf` et `Amiri-Bold.ttf` dans `backend/assets/fonts/`

## Vérification

Après avoir ajouté la police, redémarrez votre serveur Node.js. Les messages dans la console indiqueront si la police arabe a été chargée avec succès.

## Polices supportées

Le système cherche automatiquement les polices suivantes (dans cet ordre) :
- NotoSansArabic-Regular.ttf / NotoSansArabic-Bold.ttf
- Amiri-Regular.ttf / Amiri-Bold.ttf
- Cairo-Regular.ttf / Cairo-Bold.ttf
- Arial-Unicode-MS.ttf

Si aucune de ces polices n'est trouvée dans `backend/assets/fonts/`, le système essaiera d'utiliser des polices système communes.

