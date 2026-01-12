const LogisticsEntry = require('../models/logisticsEntry.model');
const LogisticsExit = require('../models/logisticsExit.model');
const Material = require('../models/material.model');
const PurchaseOrder = require('../models/purchaseOrder.model');
const logger = require('../utils/logger');

// ========== ENTRIES (ENTRÉES) ==========

exports.getEntries = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      productName,
      startDate,
      endDate
    } = req.query;

    const query = {};

    if (productName) {
      query.productName = { $regex: productName, $options: 'i' };
    }
    if (startDate || endDate) {
      query.entryDate = {};
      if (startDate) query.entryDate.$gte = new Date(startDate);
      if (endDate) query.entryDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const entries = await LogisticsEntry.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ entryDate: -1 });

    const total = await LogisticsEntry.countDocuments(query);

    res.json({
      entries,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Erreur récupération entrées:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getEntry = async (req, res) => {
  try {
    const entry = await LogisticsEntry.findById(req.params.id)
      .populate('siteId', 'name code')
      .populate('agentId', 'firstName lastName');

    if (!entry) {
      return res.status(404).json({ message: 'Entrée non trouvée' });
    }

    res.json({ entry });
  } catch (error) {
    logger.error('Erreur récupération entrée:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.createEntry = async (req, res) => {
  try {
    const { 
      materialId, 
      productName, 
      quantity, 
      unit, 
      unitPrice, 
      entryDate, 
      entryType, 
      purchaseOrderId, 
      siteId, 
      supplier, 
      notes 
    } = req.body;

    // Vérifier que le matériel existe
    let material = null;
    if (materialId) {
      material = await Material.findById(materialId);
      if (!material) {
        return res.status(404).json({ message: 'Matériel non trouvé' });
      }
    }

    // Si purchaseOrderId est fourni, vérifier qu'il existe
    if (purchaseOrderId) {
      const purchaseOrder = await PurchaseOrder.findById(purchaseOrderId);
      if (!purchaseOrder) {
        return res.status(404).json({ message: 'Bon de commande non trouvé' });
      }
    }

    const entry = new LogisticsEntry({
      materialId: materialId || null,
      productName: productName || (material ? material.name : ''),
      quantity,
      unit: unit || (material ? material.unit : 'unité'),
      unitPrice: unitPrice || (material ? material.unitPrice : 0),
      entryDate: entryDate || new Date(),
      entryType: entryType || 'purchase',
      purchaseOrderId: purchaseOrderId || null,
      siteId: null, // Les entrées vont toujours au magasin général
      supplier: supplier || (material && material.supplier ? material.supplier : null),
      receivedBy: req.userId,
      notes
    });

    await entry.save();

    // Si c'est lié à un bon de commande, mettre à jour son statut
    if (purchaseOrderId) {
      const purchaseOrder = await PurchaseOrder.findById(purchaseOrderId);
      if (purchaseOrder && purchaseOrder.status === 'sent') {
        purchaseOrder.status = 'received';
        purchaseOrder.actualDeliveryDate = entryDate || new Date();
        await purchaseOrder.save();
      }
    }

    const populatedEntry = await LogisticsEntry.findById(entry._id)
      .populate('materialId', 'code name unit')
      .populate('siteId', 'name code')
      .populate('purchaseOrderId', 'orderNumber')
      .populate('receivedBy', 'email');

    res.status(201).json({
      message: 'Entrée créée avec succès',
      entry: populatedEntry
    });
  } catch (error) {
    logger.error('Erreur création entrée:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.updateEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { productName, quantity, entryDate, notes } = req.body;

    const oldEntry = await LogisticsEntry.findById(id);
    if (!oldEntry) {
      return res.status(404).json({ message: 'Entrée non trouvée' });
    }

    const entry = await LogisticsEntry.findByIdAndUpdate(
      id,
      { productName, quantity, entryDate, notes },
      { new: true, runValidators: true }
    );

    res.json({
      message: 'Entrée mise à jour avec succès',
      entry
    });
  } catch (error) {
    logger.error('Erreur mise à jour entrée:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.deleteEntry = async (req, res) => {
  try {
    const entry = await LogisticsEntry.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ message: 'Entrée non trouvée' });
    }

    await LogisticsEntry.findByIdAndDelete(req.params.id);

    res.json({ message: 'Entrée supprimée avec succès' });
  } catch (error) {
    logger.error('Erreur suppression entrée:', error);
    res.status(500).json({ message: error.message });
  }
};

// ========== EXITS (SORTIES) ==========

exports.getExits = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      productName,
      destinationSiteId,
      sourceSiteId,
      agentId,
      startDate,
      endDate
    } = req.query;

    const query = {};

    if (productName) {
      query.productName = { $regex: productName, $options: 'i' };
    }
    if (destinationSiteId) {
      query.destinationSiteId = destinationSiteId;
    }
    if (sourceSiteId) {
      query.sourceSiteId = sourceSiteId;
    }
    if (agentId) {
      query.agentId = agentId;
    }
    if (startDate || endDate) {
      query.exitDate = {};
      if (startDate) query.exitDate.$gte = new Date(startDate);
      if (endDate) query.exitDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const exits = await LogisticsExit.find(query)
      .populate('sourceSiteId', 'name code')
      .populate('destinationSiteId', 'name code')
      .populate('agentId', 'firstName lastName')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ exitDate: -1 });

    const total = await LogisticsExit.countDocuments(query);

    res.json({
      exits,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Erreur récupération sorties:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getExit = async (req, res) => {
  try {
    const exit = await LogisticsExit.findById(req.params.id)
      .populate('sourceSiteId', 'name code')
      .populate('destinationSiteId', 'name code')
      .populate('agentId', 'firstName lastName');

    if (!exit) {
      return res.status(404).json({ message: 'Sortie non trouvée' });
    }

    res.json({ exit });
  } catch (error) {
    logger.error('Erreur récupération sortie:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.createExit = async (req, res) => {
  try {
    const { materialId, productName, quantity, unit, exitDate, sourceSiteId, destinationType, destinationSiteId, agentId, exitType, notes } = req.body;

    // Par défaut, les sorties partent du magasin (sourceSiteId = null)
    // Convertir les chaînes vides, undefined, etc. en null
    const actualSourceSiteId = (sourceSiteId && sourceSiteId !== '' && sourceSiteId !== 'null') ? sourceSiteId : null;
    const actualMaterialId = (materialId && materialId !== '' && materialId !== 'null') ? materialId : null;
    const actualDestinationSiteId = (destinationSiteId && destinationSiteId !== '' && destinationSiteId !== 'null' && destinationType === 'site') ? destinationSiteId : null;
    const actualAgentId = (agentId && agentId !== '' && agentId !== 'null' && destinationType === 'agent') ? agentId : null;

    // Vérifier le stock disponible en temps réel
    const availableStock = await calculateStockQuantity(actualSourceSiteId, productName);
    
    if (availableStock < quantity) {
      return res.status(400).json({ 
        message: `Stock insuffisant${actualSourceSiteId ? ' sur le site' : ' au magasin'}. Stock disponible: ${availableStock}` 
      });
    }

    const exit = new LogisticsExit({
      materialId: actualMaterialId,
      productName,
      quantity,
      unit: unit || 'unité',
      exitDate: exitDate || new Date(),
      exitType: exitType || 'transfer',
      sourceSiteId: actualSourceSiteId, // null = magasin
      destinationType: destinationType || (actualDestinationSiteId ? 'site' : actualAgentId ? 'agent' : 'site'),
      destinationSiteId: actualDestinationSiteId,
      agentId: actualAgentId,
      notes: notes || undefined
    });

    await exit.save();

    const populatedExit = await LogisticsExit.findById(exit._id)
      .populate('sourceSiteId', 'name code')
      .populate('destinationSiteId', 'name code')
      .populate('agentId', 'firstName lastName')
      .populate('materialId', 'code name unit');

    res.status(201).json({
      message: 'Sortie créée avec succès',
      exit: populatedExit
    });
  } catch (error) {
    logger.error('Erreur création sortie:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.updateExit = async (req, res) => {
  try {
    const { id } = req.params;
    const { productName, quantity, exitDate, sourceSiteId, destinationSiteId, agentId, destinationType, notes } = req.body;

    const oldExit = await LogisticsExit.findById(id);
    if (!oldExit) {
      return res.status(404).json({ message: 'Sortie non trouvée' });
    }

    // Si la quantité ou la source a changé, vérifier le nouveau stock disponible
    const newSourceSiteId = sourceSiteId !== undefined ? (sourceSiteId || null) : oldExit.sourceSiteId;
    const newQuantity = quantity !== undefined ? quantity : oldExit.quantity;
    const newProductName = productName || oldExit.productName;

    // Si on modifie la quantité à la hausse ou la source, vérifier le stock
    if (newQuantity > oldExit.quantity || newSourceSiteId?.toString() !== oldExit.sourceSiteId?.toString()) {
      const availableStock = await calculateStockQuantity(newSourceSiteId, newProductName);
      // Si on augmente, vérifier qu'on a assez avec l'ancienne sortie enlevée
      const quantityDifference = newQuantity - oldExit.quantity;
      const stockAfterOldExit = availableStock + oldExit.quantity;
      
      if (stockAfterOldExit < newQuantity) {
        return res.status(400).json({ 
          message: `Stock insuffisant${newSourceSiteId ? ' sur le site' : ' au magasin'}. Stock disponible: ${stockAfterOldExit}` 
        });
      }
    }

    const exit = await LogisticsExit.findByIdAndUpdate(
      id,
      { 
        productName: newProductName, 
        quantity: newQuantity, 
        exitDate: exitDate || oldExit.exitDate, 
        sourceSiteId: newSourceSiteId, 
        destinationSiteId: destinationSiteId !== undefined ? (destinationSiteId || null) : oldExit.destinationSiteId,
        agentId: agentId !== undefined ? (agentId || null) : oldExit.agentId,
        destinationType: destinationType || oldExit.destinationType,
        notes: notes !== undefined ? notes : oldExit.notes
      },
      { new: true, runValidators: true }
    )
      .populate('sourceSiteId', 'name code')
      .populate('destinationSiteId', 'name code')
      .populate('agentId', 'firstName lastName');

    res.json({
      message: 'Sortie mise à jour avec succès',
      exit
    });
  } catch (error) {
    logger.error('Erreur mise à jour sortie:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.deleteExit = async (req, res) => {
  try {
    const exit = await LogisticsExit.findById(req.params.id);
    if (!exit) {
      return res.status(404).json({ message: 'Sortie non trouvée' });
    }

    await LogisticsExit.findByIdAndDelete(req.params.id);

    res.json({ message: 'Sortie supprimée avec succès' });
  } catch (error) {
    logger.error('Erreur suppression sortie:', error);
    res.status(500).json({ message: error.message });
  }
};

// ========== STOCK (INVENTAIRE) - Calculé en temps réel ==========

// Fonction pour calculer le stock disponible en temps réel
async function calculateStockQuantity(siteId, productName) {
  try {
    const actualSiteId = siteId || null;
    let quantity = 0;

    if (actualSiteId === null) {
      // Stock au magasin : somme des entrées - somme des sorties depuis le magasin
      const totalEntries = await LogisticsEntry.aggregate([
        {
          $match: {
            productName: productName
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$quantity' }
          }
        }
      ]);

      const totalExits = await LogisticsExit.aggregate([
        {
          $match: {
            productName: productName,
            sourceSiteId: null
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$quantity' }
          }
        }
      ]);

      quantity = (totalEntries[0]?.total || 0) - (totalExits[0]?.total || 0);
    } else {
      // Stock sur un site : somme des sorties vers ce site - somme des sorties depuis ce site
      const entriesToSite = await LogisticsExit.aggregate([
        {
          $match: {
            productName: productName,
            destinationSiteId: actualSiteId,
            destinationType: 'site'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$quantity' }
          }
        }
      ]);

      const exitsFromSite = await LogisticsExit.aggregate([
        {
          $match: {
            productName: productName,
            sourceSiteId: actualSiteId
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$quantity' }
          }
        }
      ]);

      quantity = (entriesToSite[0]?.total || 0) - (exitsFromSite[0]?.total || 0);
    }

    return Math.max(0, quantity);
  } catch (error) {
    logger.error('Erreur calcul stock:', error);
    return 0;
  }
}

// Fonction pour obtenir tous les produits uniques avec leur stock
async function getAllProductsWithStock(siteId, locationType) {
  try {
    const actualSiteId = siteId === 'null' || siteId === null ? null : siteId;
    
    // Récupérer tous les produits uniques depuis les entrées
    const allProducts = await LogisticsEntry.aggregate([
      {
        $group: {
          _id: '$productName',
          unit: { $first: '$unit' },
          materialId: { $first: '$materialId' }
        }
      }
    ]);

    // Ajouter les produits qui apparaissent uniquement dans les sorties vers les sites
    if (actualSiteId !== null) {
      const productsFromExits = await LogisticsExit.aggregate([
        {
          $match: {
            destinationSiteId: actualSiteId,
            destinationType: 'site'
          }
        },
        {
          $group: {
            _id: '$productName',
            unit: { $first: '$unit' },
            materialId: { $first: '$materialId' }
          }
        }
      ]);

      // Fusionner les listes
      const existingProducts = new Set(allProducts.map(p => p._id));
      productsFromExits.forEach(p => {
        if (!existingProducts.has(p._id)) {
          allProducts.push(p);
        }
      });
    }

    // Calculer le stock pour chaque produit
    const productsWithStock = await Promise.all(
      allProducts.map(async (product) => {
        const quantity = await calculateStockQuantity(actualSiteId, product._id);
        
        // Récupérer le matériel si disponible
        let material = null;
        if (product.materialId) {
          material = await Material.findById(product.materialId).lean();
        }

        // Calculer les sorties totales depuis cette localisation
        const totalExited = await LogisticsExit.aggregate([
          {
            $match: {
              productName: product._id,
              sourceSiteId: actualSiteId
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$quantity' }
            }
          }
        ]);

        return {
          productName: product._id,
          quantity: quantity,
          unit: product.unit || 'unité',
          materialId: product.materialId || null,
          siteId: actualSiteId,
          locationType: actualSiteId === null ? 'warehouse' : 'site',
          totalExited: totalExited[0]?.total || 0,
          material: material
        };
      })
    );

    // Filtrer les produits avec stock > 0 ou qui ont eu des mouvements
    return productsWithStock.filter(p => p.quantity > 0 || p.totalExited > 0);
  } catch (error) {
    logger.error('Erreur récupération produits avec stock:', error);
    return [];
  }
}

exports.getStocks = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      productName,
      siteId,
      locationType // 'warehouse' | 'site' | 'agent' | 'all'
    } = req.query;

    // Récupérer tous les produits avec leur stock
    const allProductsWithStock = await getAllProductsWithStock(siteId, locationType);

    // Filtrer par productName si fourni
    let filteredProducts = allProductsWithStock;
    if (productName) {
      const regex = new RegExp(productName, 'i');
      filteredProducts = allProductsWithStock.filter(p => regex.test(p.productName));
    }

    // Filtrer par locationType si fourni
    if (locationType && locationType !== 'all') {
      filteredProducts = filteredProducts.filter(p => p.locationType === locationType);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = filteredProducts.length;
    const paginatedProducts = filteredProducts.slice(skip, skip + parseInt(limit));

    // Populate les sites
    const Site = require('../models/site.model');
    const stocksWithDetails = await Promise.all(
      paginatedProducts.map(async (product) => {
        let site = null;
        let siteIdValue = product.siteId;
        
        // Si c'est un site (pas le magasin), récupérer les détails
        if (product.siteId && product.locationType === 'site') {
          site = await Site.findById(product.siteId).select('name code').lean();
          siteIdValue = site;
        }

        return {
          _id: product.materialId ? String(product.materialId) : `stock_${product.productName}_${product.siteId || 'warehouse'}`,
          productName: product.productName,
          quantity: product.quantity,
          unit: product.unit,
          materialId: product.material ? product.material : (product.materialId ? String(product.materialId) : null),
          siteId: siteIdValue,
          locationType: product.locationType,
          totalExited: product.totalExited,
          lastUpdated: new Date(), // Toujours à jour car calculé en temps réel
          locationLabel: product.siteId && site ? (site.name || 'Site') : 'Magasin'
        };
      })
    );

    res.json({
      stocks: stocksWithDetails,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Erreur récupération stocks:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getStock = async (req, res) => {
  try {
    // Le stock est maintenant calculé dynamiquement, cette route peut retourner un produit spécifique
    // Pour l'instant, on retourne une erreur car on n'a plus d'ID unique pour le stock
    res.status(404).json({ message: 'Route obsolète. Utilisez /stocks avec les filtres productName et siteId' });
  } catch (error) {
    logger.error('Erreur récupération stock:', error);
    res.status(500).json({ message: error.message });
  }
};


// Dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    
    // Calculer les dates selon la période
    const now = new Date();
    let startDate;
    if (range === '7d') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === '30d') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      startDate = new Date(0); // Tout l'historique
    }

    // Statistiques générales
    // Calculer le stock total en temps réel (somme de toutes les entrées - somme de toutes les sorties du magasin)
    const totalEntriesAgg = await LogisticsEntry.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$quantity' }
        }
      }
    ]);

    const totalExitsFromWarehouse = await LogisticsExit.aggregate([
      {
        $match: {
          sourceSiteId: null
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$quantity' }
        }
      }
    ]);

    const totalStock = (totalEntriesAgg[0]?.total || 0) - (totalExitsFromWarehouse[0]?.total || 0);

    const totalEntries = await LogisticsEntry.countDocuments({
      entryDate: { $gte: startDate }
    });

    const totalExits = await LogisticsExit.countDocuments({
      exitDate: { $gte: startDate }
    });

    // Récupérer les produits distincts depuis les entrées
    const distinctProductsAgg = await LogisticsEntry.aggregate([
      {
        $group: {
          _id: '$productName'
        }
      }
    ]);
    const distinctProducts = distinctProductsAgg.map(p => p._id).filter(Boolean);

    // Évolution des entrées et sorties par jour (30 derniers jours)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const entriesEvolution = await LogisticsEntry.aggregate([
      {
        $match: {
          entryDate: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$entryDate' } },
          total: { $sum: '$quantity' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const exitsEvolution = await LogisticsExit.aggregate([
      {
        $match: {
          exitDate: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$exitDate' } },
          total: { $sum: '$quantity' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Répartition par produit (top 10) - calculé en temps réel
    const productsFromEntries = await LogisticsEntry.aggregate([
      {
        $group: {
          _id: '$productName',
          totalEntries: { $sum: '$quantity' }
        }
      }
    ]);

    const productsFromExits = await LogisticsExit.aggregate([
      {
        $match: {
          sourceSiteId: null
        }
      },
      {
        $group: {
          _id: '$productName',
          totalExits: { $sum: '$quantity' }
        }
      }
    ]);

    // Fusionner et calculer les stocks
    const stockMap = new Map();
    productsFromEntries.forEach(p => {
      stockMap.set(p._id, { productName: p._id, total: p.totalEntries });
    });
    productsFromExits.forEach(p => {
      const existing = stockMap.get(p._id) || { productName: p._id, total: 0 };
      existing.total = (existing.total || 0) - (p.totalExits || 0);
      stockMap.set(p._id, existing);
    });

    const productsDistribution = Array.from(stockMap.values())
      .map(p => ({ _id: p.productName, total: Math.max(0, p.total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Sorties par site
    const exitsBySite = await LogisticsExit.aggregate([
      {
        $match: {
          exitDate: { $gte: startDate }
        }
      },
      {
        $lookup: {
          from: 'sites',
          localField: 'destinationSiteId',
          foreignField: '_id',
          as: 'site'
        }
      },
      {
        $unwind: {
          path: '$site',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: '$destinationSiteId',
          siteName: { $first: '$site.name' },
          total: { $sum: '$quantity' },
          count: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      overview: {
        totalStock: Math.max(0, totalStock),
        totalEntries,
        totalExits,
        distinctProducts: distinctProducts.length
      },
      charts: {
        entriesEvolution: entriesEvolution.map(item => ({
          date: item._id,
          total: item.total,
          count: item.count
        })),
        exitsEvolution: exitsEvolution.map(item => ({
          date: item._id,
          total: item.total,
          count: item.count
        })),
        productsDistribution: productsDistribution.reduce((acc, item) => {
          acc[item._id] = item.total;
          return acc;
        }, {}),
        exitsBySite: exitsBySite.map(item => ({
          siteName: item.siteName || 'N/A',
          total: item.total,
          count: item.count
        }))
      }
    });
  } catch (error) {
    logger.error('Erreur récupération statistiques dashboard:', error);
    res.status(500).json({ message: error.message });
  }
};

// ========== MATERIALS (MATÉRIAUX) ==========

exports.getMaterials = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      isActive
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (category) {
      query.category = category;
    }
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const materials = await Material.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ name: 1 });

    const total = await Material.countDocuments(query);

    res.json({
      materials,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Erreur récupération matériaux:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getMaterial = async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);

    if (!material) {
      return res.status(404).json({ message: 'Matériel non trouvé' });
    }

    res.json({ material });
  } catch (error) {
    logger.error('Erreur récupération matériel:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.createMaterial = async (req, res) => {
  try {
    const material = new Material(req.body);
    await material.save();

    res.status(201).json({
      message: 'Matériel créé avec succès',
      material
    });
  } catch (error) {
    logger.error('Erreur création matériel:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.updateMaterial = async (req, res) => {
  try {
    const material = await Material.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!material) {
      return res.status(404).json({ message: 'Matériel non trouvé' });
    }

    res.json({
      message: 'Matériel mis à jour avec succès',
      material
    });
  } catch (error) {
    logger.error('Erreur mise à jour matériel:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.deleteMaterial = async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ message: 'Matériel non trouvé' });
    }

    // Vérifier si le matériel est utilisé dans des entrées ou sorties
    const entryCount = await LogisticsEntry.countDocuments({ materialId: material._id });
    const exitCount = await LogisticsExit.countDocuments({ materialId: material._id });
    if (entryCount > 0 || exitCount > 0) {
      return res.status(400).json({ 
        message: 'Impossible de supprimer ce matériel car il est utilisé dans des entrées ou sorties. Désactivez-le à la place.' 
      });
    }

    await Material.findByIdAndDelete(req.params.id);

    res.json({ message: 'Matériel supprimé avec succès' });
  } catch (error) {
    logger.error('Erreur suppression matériel:', error);
    res.status(500).json({ message: error.message });
  }
};

// ========== DOCUMENTS PDF ==========

exports.generateExitDocument = async (req, res) => {
  try {
    const exitDocumentPdfService = require('../services/exitDocumentPdf.service');
    const exit = await LogisticsExit.findById(req.params.id);

    if (!exit) {
      return res.status(404).json({ message: 'Sortie non trouvée' });
    }

    const doc = await exitDocumentPdfService.generatePDF(req.params.id);

    // Récupérer les infos pour le nom du fichier
    const exitForFilename = await LogisticsExit.findById(req.params.id)
      .populate('sourceSiteId', 'name')
      .lean();
    
    const siteName = exitForFilename?.sourceSiteId?.name || 'site';
    const filename = `sortie-${exit.exitNumber || exit._id}-${siteName}.pdf`;

    // Configurer les en-têtes de réponse AVANT de pipé
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    // Pipe le PDF directement à la réponse
    doc.pipe(res);
    doc.flushPages();
    doc.end();
  } catch (error) {
    logger.error('Erreur génération document sortie:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    } else {
      res.end();
    }
  }
};

exports.generateEntryDocument = async (req, res) => {
  try {
    const entryDocumentPdfService = require('../services/entryDocumentPdf.service');
    const entry = await LogisticsEntry.findById(req.params.id);

    if (!entry) {
      return res.status(404).json({ message: 'Entrée non trouvée' });
    }

    const doc = await entryDocumentPdfService.generatePDF(req.params.id);

    // Récupérer les infos pour le nom du fichier
    const entryForFilename = await LogisticsEntry.findById(req.params.id)
      .populate('siteId', 'name')
      .lean();
    
    const siteName = entryForFilename?.siteId?.name || 'site';
    const filename = `entree-${entry.entryNumber || entry._id}-${siteName}.pdf`;

    // Configurer les en-têtes de réponse AVANT de pipé
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    // Pipe le PDF directement à la réponse
    doc.pipe(res);
    doc.flushPages();
    doc.end();
  } catch (error) {
    logger.error('Erreur génération document entrée:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    } else {
      res.end();
    }
  }
};