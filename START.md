# Guide de démarrage du serveur backend

## Méthode 1 : Commande PowerShell (recommandée)

Ouvrez PowerShell dans le dossier `backend` et exécutez :

```powershell
.\start-server.ps1
```

## Méthode 2 : Commande Node.js directe

Dans le dossier `backend`, exécutez :

```bash
node server.js
```

## Méthode 3 : Avec npm (si configuré)

```bash
npm start
```

## Vérification

Une fois le serveur démarré, vous devriez voir :

```
✓ Serveur démarré avec succès sur http://localhost:5000
✓ Routes disponibles:
  - /api/bulletins/:studentId?action=download|view
  - /api/students, /api/evaluations, etc.

Appuyez sur Ctrl+C pour arrêter le serveur
```

## Résolution de problèmes

### Le serveur ne démarre pas

1. **Vérifier que Node.js est installé** :
   ```powershell
   node --version
   ```

2. **Vérifier que les dépendances sont installées** :
   ```powershell
   npm install
   ```

3. **Vérifier que MongoDB est démarré** (si utilisé localement)

4. **Vérifier que le port 5000 n'est pas déjà utilisé** :
   ```powershell
   netstat -ano | findstr ":5000"
   ```

### Le serveur démarre mais se ferme immédiatement

- Vérifiez les logs dans `logs/error.log` et `logs/exceptions.log`
- Vérifiez que MongoDB est accessible
- Vérifiez le fichier `.env` pour les configurations

## Routes de bulletin disponibles

- **Télécharger** : `GET /api/bulletins/:studentId?action=download&anneeAcademiqueId=...&trimestre=...`
- **Visualiser** : `GET /api/bulletins/:studentId?action=view&anneeAcademiqueId=...&trimestre=...`



