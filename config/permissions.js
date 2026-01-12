/**
 * Configuration des permissions par rôle
 * Format: resource: { action: [roles autorisés] }
 */

const PERMISSIONS = {
  // Gestion des agents
  agents: {
    create: ['super_admin', 'recruiter'],
    read: ['super_admin', 'recruiter', 'planner', 'accountant', 'agent'],
    update: ['super_admin', 'recruiter', 'planner'],
    delete: ['super_admin'],
    verify: ['super_admin', 'recruiter'],
    viewDocuments: ['super_admin', 'recruiter', 'planner']
  },

  // Gestion des clients
  clients: {
    create: ['super_admin', 'recruiter'],
    read: ['super_admin', 'recruiter', 'planner', 'accountant', 'client'],
    update: ['super_admin', 'recruiter', 'client'],
    delete: ['super_admin'],
    viewContracts: ['super_admin', 'recruiter', 'accountant', 'client']
  },

  // Gestion des sites
  sites: {
    create: ['super_admin', 'recruiter', 'client'],
    read: ['super_admin', 'recruiter', 'planner', 'accountant', 'agent', 'client'],
    update: ['super_admin', 'recruiter', 'client'],
    delete: ['super_admin', 'recruiter']
  },


  // Gestion de la paie
  payrolls: {
    create: ['super_admin', 'accountant'],
    read: ['super_admin', 'accountant', 'agent'],
    update: ['super_admin', 'accountant'],
    delete: ['super_admin'],
    export: ['super_admin', 'accountant'],
    markPaid: ['super_admin', 'accountant']
  },

  // Gestion des documents
  documents: {
    upload: ['super_admin', 'recruiter', 'agent', 'client'],
    read: ['super_admin', 'recruiter', 'planner', 'agent', 'client'],
    delete: ['super_admin', 'recruiter'],
    verify: ['super_admin', 'recruiter']
  },

  // Gestion des feedbacks
  feedbacks: {
    create: ['super_admin', 'client'],
    read: ['super_admin', 'recruiter', 'planner', 'agent', 'client'],
    update: ['super_admin', 'client'],
    delete: ['super_admin']
  },

  // Gestion des utilisateurs
  users: {
    create: ['super_admin'],
    read: ['super_admin', 'recruiter'],
    update: ['super_admin'],
    delete: ['super_admin'],
    changeRole: ['super_admin'],
    activate: ['super_admin'],
    deactivate: ['super_admin']
  },

  // Dashboard et reporting
  dashboard: {
    view: ['super_admin', 'recruiter', 'planner', 'accountant'],
    viewStats: ['super_admin', 'recruiter', 'planner', 'accountant'],
    exportReports: ['super_admin', 'accountant']
  },

  // Matching
  matching: {
    view: ['super_admin', 'planner'],
    suggest: ['super_admin', 'planner'],
    autoMatch: ['super_admin', 'planner']
  },

  // Paramètres système
  settings: {
    view: ['super_admin'],
    update: ['super_admin'],
    manageRoles: ['super_admin'],
    managePermissions: ['super_admin']
  },

  // Soumissions d'appels d'offres
  tenderSubmissions: {
    create: ['super_admin', 'recruiter'],
    read: ['super_admin', 'recruiter', 'accountant'],
    update: ['super_admin', 'recruiter'],
    delete: ['super_admin'],
    submit: ['super_admin', 'recruiter'],
    review: ['super_admin']
  },

  // Gestion de la logistique
  logistics: {
    create: ['super_admin', 'planner', 'agent'],
    read: ['super_admin', 'planner', 'accountant', 'agent'],
    update: ['super_admin', 'planner'],
    delete: ['super_admin', 'planner']
  },

  // Gestion des avances sur salaire
  advances: {
    create: ['super_admin', 'accountant'],
    read: ['super_admin', 'accountant', 'agent'],
    update: ['super_admin', 'accountant'],
    delete: ['super_admin']
  }
};

/**
 * Vérifie si un rôle a une permission spécifique
 * @param {string} role - Le rôle de l'utilisateur
 * @param {string} resource - La ressource (agents, missions, etc.)
 * @param {string} action - L'action (create, read, update, delete, etc.)
 * @param {object} customPermissions - Permissions personnalisées (optionnel)
 * @returns {boolean}
 */
function hasPermission(role, resource, action, customPermissions = null) {
  // Super admin a tous les droits (sauf si des permissions personnalisées sont définies)
  if (role === 'super_admin' && !customPermissions) {
    return true;
  }

  // Vérifier si la ressource existe
  if (!PERMISSIONS[resource]) {
    return false;
  }

  // Vérifier si l'action existe pour cette ressource
  if (!PERMISSIONS[resource][action]) {
    return false;
  }

  // Si des permissions personnalisées existent pour cette ressource/action, les utiliser
  if (customPermissions && 
      customPermissions[resource] && 
      customPermissions[resource][action] !== undefined) {
    return customPermissions[resource][action] === true;
  }

  // Sinon, vérifier si le rôle est autorisé
  return PERMISSIONS[resource][action].includes(role);
}

/**
 * Récupère toutes les permissions d'un rôle
 * @param {string} role - Le rôle
 * @param {object} customPermissions - Permissions personnalisées (optionnel)
 * @returns {object} - Objet avec toutes les permissions
 */
function getRolePermissions(role, customPermissions = null) {
  const permissions = {};

  // Super admin a tous les droits (sauf si des permissions personnalisées sont définies)
  if (role === 'super_admin' && !customPermissions) {
    Object.keys(PERMISSIONS).forEach(resource => {
      permissions[resource] = {};
      Object.keys(PERMISSIONS[resource]).forEach(action => {
        permissions[resource][action] = true;
      });
    });
    return permissions;
  }

  // Pour les autres rôles, vérifier chaque permission
  Object.keys(PERMISSIONS).forEach(resource => {
    permissions[resource] = {};
    Object.keys(PERMISSIONS[resource]).forEach(action => {
      // Si des permissions personnalisées existent pour cette ressource/action, les utiliser
      if (customPermissions && 
          customPermissions[resource] && 
          customPermissions[resource][action] !== undefined) {
        permissions[resource][action] = customPermissions[resource][action];
      } else {
        // Sinon, utiliser les permissions par défaut du rôle
        permissions[resource][action] = PERMISSIONS[resource][action].includes(role);
      }
    });
  });

  return permissions;
}

/**
 * Récupère toutes les ressources et actions disponibles
 * @returns {object} - Structure complète des permissions
 */
function getAllResourcesAndActions() {
  return PERMISSIONS;
}

module.exports = {
  PERMISSIONS,
  hasPermission,
  getRolePermissions,
  getAllResourcesAndActions
};

