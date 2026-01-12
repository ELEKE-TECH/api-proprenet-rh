const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Créer le dossier uploads s'il n'existe pas
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuration du stockage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = uploadDir;
    
    // Définir le sous-dossier selon le type de fichier
    if (file.fieldname === 'photo') {
      uploadPath = path.join(uploadDir, 'photos');
    } else if (file.fieldname === 'documents' || file.fieldname === 'document') {
      uploadPath = path.join(uploadDir, 'documents');
    } else if (file.fieldname === 'avatar') {
      uploadPath = path.join(uploadDir, 'avatars');
    }
    
    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Générer un nom de fichier unique
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, extension);
    const filename = `${nameWithoutExt}-${uniqueSuffix}${extension}`;
    cb(null, filename);
  }
});

// Filtre des types de fichiers autorisés
const fileFilter = (req, file, cb) => {
  // Types de fichiers autorisés pour les photos
  if (file.fieldname === 'photo' || file.fieldname === 'avatar') {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers image (JPEG, JPG, PNG, GIF, WEBP) sont autorisés pour les photos'));
    }
  }
  
  // Types de fichiers autorisés pour les documents
  if (file.fieldname === 'documents') {
    const allowedTypes = /pdf|doc|docx|xls|xlsx|ppt|pptx|txt|jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || /image\/(jpeg|jpg|png|gif)/.test(file.mimetype) || /application\/(pdf|msword|vnd\.openxmlformats-officedocument|vnd\.ms-excel|vnd\.ms-powerpoint)/.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers PDF, Word, Excel, PowerPoint, TXT et Images sont autorisés pour les documents'));
    }
  }
  
  // Par défaut, accepter le fichier
  cb(null, true);
};

// Configuration de Multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 10 // Maximum 10 fichiers par requête (pour les documents multiples)
  },
  fileFilter: fileFilter
});

// Middleware spécifique pour une photo unique
const uploadSinglePhoto = upload.single('photo');

// Middleware spécifique pour un avatar unique
const uploadSingleAvatar = upload.single('avatar');

// Middleware spécifique pour plusieurs documents
const uploadMultipleDocuments = upload.array('documents', 10);

// Middleware pour gérer les erreurs de Multer
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'Fichier trop volumineux. Taille maximale autorisée : 10MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        message: 'Trop de fichiers. Maximum autorisé : 5 fichiers'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        message: 'Champ de fichier inattendu'
      });
    }
  }
  
  if (error.message) {
    return res.status(400).json({
      message: error.message
    });
  }
  
  next(error);
};

// Middleware pour nettoyer les fichiers en cas d'erreur
const cleanupFiles = (req, res, next) => {
  // Si une erreur se produit, supprimer les fichiers uploadés
  res.on('finish', () => {
    if (res.statusCode >= 400 && req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
  });
  next();
};

module.exports = {
  upload,
  uploadSinglePhoto,
  uploadSingleAvatar,
  uploadMultipleDocuments,
  handleUploadError,
  cleanupFiles
};




