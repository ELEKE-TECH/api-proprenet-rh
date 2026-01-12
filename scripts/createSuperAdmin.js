require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const connectDB = require('../config/db');
const logger = require('../utils/logger');
const { getRolePermissions } = require('../config/permissions');

const createSuperAdmin = async () => {
  try {
    // Connexion à la base de données
    await connectDB();

    const email = process.env.SUPER_ADMIN_EMAIL || 'admin@proprenet.com';
    const password = process.env.SUPER_ADMIN_PASSWORD || 'admin123';
    const phone = process.env.SUPER_ADMIN_PHONE || '+23500000000';
    const firstName = process.env.SUPER_ADMIN_FIRST_NAME || 'Super';
    const lastName = process.env.SUPER_ADMIN_LAST_NAME || 'Admin';
    const forceUpdate = process.env.FORCE_UPDATE === 'true' || process.argv.includes('--force');

    console.log('\n🔧 Création/Mise à jour du Super Admin...\n');

    // Vérifier si le super admin existe déjà
    const existingAdmin = await User.findOne({ email: email.toLowerCase(), role: 'super_admin' });
    
    if (existingAdmin) {
      if (forceUpdate) {
        console.log('⚠️  Super admin existe déjà. Mise à jour en cours...');
        
        // Mettre à jour le super admin avec tous les droits
        const passwordHash = bcrypt.hashSync(password, 10);
        existingAdmin.passwordHash = passwordHash;
        existingAdmin.phone = phone;
        existingAdmin.isActive = true;
        existingAdmin.lastLogin = null; // Réinitialiser la dernière connexion
        existingAdmin.customPermissions = null; // S'assurer qu'il n'y a pas de restrictions
        
        // Ajouter firstName et lastName s'ils existent dans le modèle
        if (existingAdmin.schema.paths.firstName) {
          existingAdmin.firstName = firstName;
        }
        if (existingAdmin.schema.paths.lastName) {
          existingAdmin.lastName = lastName;
        }
        
        await existingAdmin.save();
        
        console.log('\n✅ Super admin mis à jour avec succès!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('  📧 Email:', email);
        console.log('  🔑 Nouveau mot de passe:', password);
        console.log('  📱 Téléphone:', phone);
        console.log('  👤 Nom:', `${firstName} ${lastName}`);
        console.log('  🎭 Rôle: super_admin');
        console.log('  ✅ Statut: Actif');
        console.log('  🔐 Permissions: TOUS LES DROITS (super_admin)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      } else {
        console.log('✅ Super admin existe déjà:', email);
        console.log('  ID:', existingAdmin._id);
        console.log('  Téléphone:', existingAdmin.phone || 'Non défini');
        console.log('  Statut:', existingAdmin.isActive ? 'Actif' : 'Inactif');
        console.log('  Permissions: TOUS LES DROITS (super_admin)');
        console.log('\n💡 Pour mettre à jour le mot de passe, utilisez:');
        console.log('   FORCE_UPDATE=true npm run seed:super-admin');
        console.log('   ou');
        console.log('   node scripts/createSuperAdmin.js --force');
      }
      await mongoose.connection.close();
      process.exit(0);
      return;
    }

    // Vérifier si un utilisateur avec cet email existe avec un autre rôle
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser && existingUser.role !== 'super_admin') {
      console.error('❌ Erreur: Un utilisateur avec cet email existe déjà avec le rôle:', existingUser.role);
      console.error('   Veuillez utiliser un email différent ou supprimer l\'utilisateur existant.');
      await mongoose.connection.close();
      process.exit(1);
      return;
    }

    // Créer le super admin avec tous les droits
    const passwordHash = bcrypt.hashSync(password, 10);
    
    const superAdminData = {
      email: email.toLowerCase(),
      phone,
      passwordHash,
      role: 'super_admin',
      isActive: true,
      customPermissions: null // Pas de restrictions, tous les droits
    };

    // Ajouter firstName et lastName s'ils existent dans le modèle
    const UserSchema = User.schema;
    if (UserSchema.paths.firstName) {
      superAdminData.firstName = firstName;
    }
    if (UserSchema.paths.lastName) {
      superAdminData.lastName = lastName;
    }
    
    const superAdmin = new User(superAdminData);

    await superAdmin.save();

    // Vérifier les permissions du super admin
    const permissions = getRolePermissions('super_admin', null);
    const totalPermissions = Object.keys(permissions).reduce((acc, resource) => {
      return acc + Object.keys(permissions[resource]).filter(action => permissions[resource][action]).length;
    }, 0);

    console.log('\n✅ Super admin créé avec succès!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  🆔 ID:', superAdmin._id);
    console.log('  📧 Email:', email);
    console.log('  📱 Téléphone:', phone);
    console.log('  👤 Nom:', `${firstName} ${lastName}`);
    console.log('  🔑 Mot de passe:', password);
    console.log('  🎭 Rôle: super_admin');
    console.log('  ✅ Statut: Actif');
    console.log('  🔐 Permissions: TOUS LES DROITS');
    console.log('  📊 Total permissions:', totalPermissions, 'actions');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  IMPORTANT: Changez le mot de passe après la première connexion!');
    console.log('\n📝 Vous pouvez maintenant vous connecter avec:');
    console.log('   Email:', email);
    console.log('   Mot de passe:', password);
    console.log('\n✨ Le super admin a accès à toutes les fonctionnalités du système.\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    logger.error('Erreur création super admin:', error);
    console.error('\n❌ Erreur:', error.message);
    if (error.code === 11000) {
      console.error('  → Un utilisateur avec cet email existe déjà');
      console.error('  → Vérifiez la base de données ou utilisez un email différent');
    }
    if (error.stack) {
      console.error('\nStack:', error.stack);
    }
    await mongoose.connection.close();
    process.exit(1);
  }
};

createSuperAdmin();
