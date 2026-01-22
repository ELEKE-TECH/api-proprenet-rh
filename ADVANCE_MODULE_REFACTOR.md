# Refonte Complète du Module Avance sur Salaire

## 🎯 Objectifs de la refonte

- ✅ Module optimisé et performant
- ✅ Aucun conflit avec le module payroll
- ✅ Compatible avec système billetage et bancaire
- ✅ Expérience utilisateur optimale
- ✅ Validation robuste et sécurisée

## 📋 Changements principaux

### 1. Modèle Advance enrichi (`backend/models/advance.model.js`)

#### Nouveaux champs ajoutés :
- **`advanceNumber`** : Numéro unique auto-généré (format: AV-YYYY-0001)
- **`totalRepaid`** : Total remboursé (calculé automatiquement)
- **`recoveryPercentage`** : Pourcentage du salaire net à déduire (alternative à monthlyRecovery)
- **`maxRecoveryAmount`** : Limite maximale de récupération par mois
- **`paymentMethod`** : Méthode de paiement (cash, bank_transfer, mobile_money, check)
- **`paymentReference`** : Référence de paiement
- **`paidAt` / `paidBy`** : Informations de paiement
- **`approvedBy` / `rejectedBy`** : Traçabilité des approbations
- **`rejectedReason`** : Raison du rejet
- **`reason` / `reasonDetails`** : Raison de la demande (urgent, medical, family, etc.)
- **`internalNotes`** : Notes internes non visibles par l'agent
- **`repayments`** : Historique complet des remboursements
- **`numberOfRepayments`** : Nombre de remboursements
- **`lastRepaymentDate`** : Date du dernier remboursement

#### Nouveaux statuts :
- `draft` : Brouillon
- `requested` : Demandé
- `approved` : Approuvé
- `rejected` : Rejeté
- `paid` : Payé
- `closed` : Clôturé
- `cancelled` : Annulé

#### Méthodes ajoutées :
- **`canBeRecoveredFromPayroll()`** : Vérifie si l'avance peut être récupérée sur un bulletin
- **`addRepayment()`** : Ajoute un remboursement à l'historique
- **`progressPercentage`** (virtuel) : Pourcentage de remboursement
- **`estimatedMonthsRemaining`** (virtuel) : Estimation des mois restants

### 2. Service dédié (`backend/services/advance.service.js`)

Service centralisé pour toute la logique métier :

#### Méthodes principales :
- **`validateAdvanceCreation()`** : Valide la création d'une avance
  - Vérifie qu'aucun salaire n'est déjà payé pour le mois
  - Vérifie les limites (max 50% du salaire de base)
  - Vérifie les avances en cours

- **`calculateRecoveryAmount()`** : Calcule le montant à récupérer

- **`applyAdvancesToPayroll()`** : Applique les remboursements sur un bulletin
  - Évite les doublons (vérifie si déjà récupéré sur la période)
  - Gère les priorités (plus anciennes en premier)
  - Respecte les limites (maxRecoveryAmount, salaire net disponible)

- **`recordPayrollRepayments()`** : Enregistre les remboursements après génération du bulletin

- **`cancelPayrollRepayments()`** : Annule les remboursements si bulletin supprimé

- **`validateMonthlyRecovery()`** : Valide les paramètres de récupération

- **`getAgentAdvanceStats()`** : Statistiques complètes pour un agent

### 3. Contrôleur amélioré (`backend/controllers/advance.controller.js`)

#### Nouvelles routes :
- `POST /` : Créer une avance
- `GET /` : Liste avec filtres avancés
- `GET /:id` : Détail avec statistiques
- `PUT /:id` : Mettre à jour (notes, raison, etc.)
- `PUT /:id/approve` : Approuver
- `PUT /:id/reject` : Rejeter
- `PUT /:id/pay` : Marquer comme payé
- `PUT /:id/repay` : Remboursement manuel
- `PUT /:id/close` : Clôturer
- `PUT /:id/cancel` : Annuler
- `GET /agent/:agentId/stats` : Statistiques de l'agent

#### Améliorations :
- Validation robuste à chaque étape
- Gestion des méthodes de paiement (billetage/bancaire)
- Traçabilité complète (qui a fait quoi, quand)
- Gestion des erreurs améliorée
- Statistiques intégrées

### 4. Intégration avec Payroll (`backend/controllers/payroll.controller.js`)

#### Changements :
- Utilise maintenant `AdvanceService` au lieu de gérer directement les avances
- Calcul automatique des remboursements lors de la génération du bulletin
- Enregistrement automatique des remboursements après création
- Annulation automatique si bulletin supprimé
- Aucun conflit possible : logique centralisée dans le service

### 5. Routes mises à jour (`backend/routes/advance.routes.js`)

- Permissions granulaires (create, read, update, approve)
- Routes RESTful cohérentes
- Protection JWT sur toutes les routes

## 🔒 Validations et sécurités

### Validations automatiques :
1. **Limite d'avances** : Maximum 50% du salaire de base en avances en cours
2. **Vérification salaire payé** : Impossible de créer une avance si salaire déjà payé pour le mois
3. **Paramètres de récupération** : Validation des montants et pourcentages
4. **Statuts** : Transitions de statut validées (ex: impossible d'approuver une avance fermée)

### Sécurités :
- Traçabilité complète (createdBy, approvedBy, paidBy, etc.)
- Notes internes séparées des notes visibles
- Historique complet des remboursements
- Impossible de modifier une avance payée ou fermée

## 💰 Support Billetage et Bancaire

### Méthodes de paiement supportées :
- **`cash`** : Billetage
- **`bank_transfer`** : Virement bancaire
- **`mobile_money`** : Mobile money
- **`check`** : Chèque

### Fonctionnalités :
- Méthode de paiement stockée avec l'avance
- Référence de paiement pour traçabilité
- Compatible avec le système de paiement des agents
- Remboursements peuvent être en cash ou via payroll

## 📊 Statistiques et rapports

### Statistiques disponibles :
- Total des avances par agent
- Montant total, restant, remboursé
- Répartition par statut
- Liste des avances actives
- Historique complet des remboursements

## 🔄 Workflow complet

1. **Création** : `draft` → `requested` (ou directement `approved`)
2. **Approbation** : `requested` → `approved`
3. **Paiement** : `approved` → `paid`
4. **Remboursement** : Automatique via payroll ou manuel
5. **Clôture** : `approved`/`paid` → `closed` (quand remaining = 0)

## 🚀 Avantages de la refonte

1. **Séparation des responsabilités** : Service dédié pour la logique métier
2. **Aucun conflit** : Intégration propre avec payroll via service
3. **Traçabilité** : Historique complet de toutes les opérations
4. **Flexibilité** : Support de multiples méthodes de paiement et récupération
5. **Validation robuste** : Empêche les erreurs et incohérences
6. **Performance** : Requêtes optimisées, calculs automatiques
7. **UX optimale** : Statistiques, filtres avancés, informations détaillées

## 📝 Notes de migration

Les avances existantes continueront de fonctionner. Les nouveaux champs seront optionnels et remplis progressivement.

Pour migrer les données existantes :
- Les avances existantes auront `advanceNumber` généré automatiquement
- Les remboursements existants peuvent être ajoutés à l'historique
- Les statuts existants sont compatibles

## 🔧 Configuration recommandée

### Limites par défaut :
- Maximum 50% du salaire de base en avances en cours
- Récupération mensuelle : montant fixe ou pourcentage
- Limite maximale de récupération par mois : configurable

### Bonnes pratiques :
- Toujours valider avant d'approuver
- Utiliser les notes internes pour le suivi
- Vérifier les statistiques avant d'approuver une nouvelle avance
- Documenter les rejets avec une raison

