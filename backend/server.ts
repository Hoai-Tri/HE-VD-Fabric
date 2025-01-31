import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { Gateway, Wallets, Contract, X509Identity, Wallet } from 'fabric-network';
import * as path from 'path';
import * as fs from 'fs'; 
import FabricCAServices from 'fabric-ca-client';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

let contract: Contract;
let authcontract: Contract;

const JWT_SECRET = 'votre_clé_secrète_pour_jwt_ici'; // Remplacez par une clé forte en production

// Étendre l'interface Request pour inclure enrollID
declare global {
  namespace Express {
    interface Request {
      enrollID?: string;
    }
  }
}

declare global {
  namespace Express {
    interface Request {
      wallet?: Wallet;
    }
  }
}

// Middleware pour vérifier le JWT
function verifyToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format attendu : "Bearer <token>"

  if (!token) {
    res.status(401).json({ error: 'Token d\'accès manquant ou invalide' });
    return;
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded: any) => {
    if (err) {
      res.status(403).json({ error: 'Token invalide' });
      return;
    }

    // Extraire enrollID du token JWT
    const enrollID = decoded.enrollID;

    // Vérifier que enrollID est bien une chaîne valide
    if (!enrollID || typeof enrollID !== 'string') {
      res.status(400).json({ error: 'ID d\'enrôlement invalide ou manquant' });
      return;
    }

    // Charger le wallet spécifique à l'utilisateur à partir du File System Wallet
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    const userWallet = await wallet.get(enrollID); // Ici, enrollID est forcément string

    if (!userWallet) {
      res.status(403).json({ error: `Aucun wallet trouvé pour cet utilisateur : ${enrollID}` });
      return;
    }

    req.wallet = wallet; // Associe le wallet à la requête utilisateur
    req.enrollID = enrollID; // Stocke enrollID dans la requête pour l'utiliser plus tard

    next();
  });
}




// Fonction pour initialiser la connexion à Hyperledger Fabric avec le wallet de l'utilisateur
// Fonction pour initialiser la connexion à Hyperledger Fabric avec le wallet de l'utilisateur
async function initContract(wallet: Wallet, enrollID: string): Promise<{ contract: Contract, authcontract: Contract }> {
  try {
    const gateway = new Gateway();
    const connectionProfilePath = path.resolve(__dirname, '..', 'gateways','InsurancePlatformGwConnection.json');
    const connectionProfile = JSON.parse(fs.readFileSync(connectionProfilePath, 'utf8'));

    // Vérifier si l'identité de l'utilisateur est dans le wallet
    const userIdentity = await wallet.get(enrollID);
    if (!userIdentity) {
      throw new Error(`Identité pour ${enrollID} non trouvée dans le wallet.`);
    }

    const connectionOptions = { wallet, identity: enrollID, discovery: { enabled: true, asLocalhost: true } };
    await gateway.connect(connectionProfile, connectionOptions);

    const network = await gateway.getNetwork('mychannel');
    const contract = network.getContract('securedrive');
    const authcontract = network.getContract('authentification');
    
    console.log('Smart contract connecté avec succès pour', enrollID);
    
    return { contract, authcontract };
  } catch (error) {
    throw new Error(`Erreur lors de la connexion au smart contract : ${error}`);
  }
}






app.get('/api/getIdentityType', verifyToken, async (req: Request, res: Response) => {
  try {
    // Initialiser le contrat avec le wallet de l'utilisateur
    const { authcontract } = await initContract(req.wallet!, req.enrollID!);

    // Appeler la fonction 'getIdentityType' sur le smart contract
    const result = await authcontract.evaluateTransaction('getIdentityType');

    // Retourner le type d'identité au frontend
    res.json({ success: true, identityType: result.toString() });
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Erreur lors de la récupération du type d'identité : ${error.message}`);

      // Transmettre le message d'erreur du smart contract au frontend
      const chaincodeError = error.message.match(/message":"([^"]+)"/);
      const errorMessage = chaincodeError ? chaincodeError[1] : 'Une erreur inconnue est survenue.';
      console.log(errorMessage)
      res.status(500).json({ success: false, error: errorMessage });
    } else {
      res.status(500).json({ success: false, error: 'Une erreur inconnue est survenue.' });
    }
  }
});


// authentification avec l'appel à `getIdentityType`
// app.post('/api/authenticate', async (req: Request, res: Response) => {
//   const { enrollID, enrollSecret } = req.body;

//   try {
//     const authenticated = await authenticateUser(enrollID, enrollSecret);
//     if (authenticated) {
//       // Générer le token JWT
//       const token = jwt.sign({ enrollID }, JWT_SECRET, { expiresIn: '1h' });

//       // Initialiser le wallet pour récupérer le type d'identité
//       const walletPath = path.join(process.cwd(), 'wallet');

//       const wallet = await Wallets.newFileSystemWallet(walletPath);
//       console.log("access to system wallet")
//       const { contract } = await initContract(wallet, enrollID);
//       console.log("access to contract")
//       const { authcontract } = await initContract(wallet, enrollID);
      
//       console.log("access to role contract")
      
//       // Appeler la fonction 'getIdentityType' sur le smart contract
//       const identityType = await authcontract.evaluateTransaction('getIdentityType');

//       // Retourner le token et le type d'identité
//       res.json({ success: true, token, identityType: identityType.toString() });
//     } else {
//       res.status(401).json({ success: false, message: 'Authentification échouée' });
//     }
//   } catch (error) {
//     if (error instanceof Error) {
//       console.error(`Erreur lors de l'authentification : ${error.message}`);
//       res.status(500).json({ success: false, error: error.message });
//     } else {
//       res.status(500).json({ success: false, error: 'Une erreur inconnue est survenue.' });
//     }
//   }
// });

// authentification simple
// app.post('/api/authenticate', async (req: Request, res: Response) => {
//   const { enrollID, enrollSecret } = req.body;

//   try {
//     const authenticated = await authenticateUser(enrollID, enrollSecret);
//     if (authenticated) {
//       const token = jwt.sign({ enrollID }, JWT_SECRET, { expiresIn: '1h' });
//       res.json({ success: true, token });
//     } else {
//       res.status(401).json({ success: false, message: 'Authentification échouée' });
//     }
//   } catch (error) {
//     res.status(500).json({ success: false, error: error });
//   }
// });

app.get('/api/getClients', verifyToken, async (req: Request, res: Response) => {
  try {
    // Initialiser le contrat avec le wallet de l'utilisateur
    const { authcontract } = await initContract(req.wallet!, req.enrollID!);

    // Appel de la fonction getClients du smart contract
    const result = await authcontract.evaluateTransaction('getClients');

    // Convertir le résultat JSON pour l'envoyer au frontend
    const clients = JSON.parse(result.toString());
    res.json({ success: true, clients });
  } catch (error) {
    console.error(`Erreur lors de la récupération des clients : ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération des clients.' });
  }
});


app.post('/api/authenticate', async (req: Request, res: Response) => {
  const { userID, userSecret } = req.body;
  try {
    const enrollID = "admin"
    const enrollSecret = "adminpw"
    const authenticated = await authenticateUser(enrollID, enrollSecret);
    if (authenticated) {
      // Générer le token JWT
      const token = jwt.sign({ enrollID }, JWT_SECRET, { expiresIn: '1h' });

      // Initialiser le wallet pour récupérer le type d'identité
      const walletPath = path.join(process.cwd(), 'wallet');

      const wallet = await Wallets.newFileSystemWallet(walletPath);
      const { contract, authcontract } = await initContract(wallet, enrollID);
      console.log(userSecret)

      const hashedSecret = crypto.createHash('sha256').update(userSecret).digest('hex');
      console.log(hashedSecret)

      
      const identityType = await authcontract.evaluateTransaction('getRole', userID, hashedSecret);

      // Retourner le token et le type d'identité
      res.json({ success: true, token, identityType: identityType.toString() });
    } else {
      res.status(401).json({ success: false, message: 'Authentification échouée' });
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Erreur lors de l'authentification : ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Une erreur inconnue est survenue.' });
    }
  }
});

app.post('/api/createOwner', verifyToken, async (req: Request, res: Response) => {
  try {
    // Initialiser le contrat avec le wallet de l'utilisateur
    const { contract, authcontract } = await initContract(req.wallet!, req.enrollID!);

    // Les données envoyées dans la requête
    const { ownerID, name, address, age } = req.body;
    
    // Utilisation du contract "owner" pour créer un propriétaire
    const result = await contract.submitTransaction('queryPrime', ownerID);
    res.json({ result: result.toString() });
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Erreur lors de la création du propriétaire : ${error.message}`);
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Une erreur inconnue est survenue.' });
    }
  }
});




// Fonction pour authentifier l'utilisateur en utilisant File System Wallet
async function authenticateUser(enrollID: string, enrollSecret: string): Promise<boolean> {
  try {
    const ccpPath = path.resolve(__dirname, '..', 'gateways', 'InsurancePlatformGwConnection.json');
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

    const caInfo = ccp.certificateAuthorities['ca1.org1.insurance.com'];  // Utilisation de la bonne CA
    const caTLSCACerts = caInfo.tlsCACerts.pem;
    const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false });

    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    // Vérifie si l'utilisateur existe déjà dans le wallet
    const userExists = await wallet.get(enrollID);
    if (userExists) {
      console.log(`L'utilisateur ${enrollID} est déjà enregistré dans le wallet.`);
      return true;
    }

    // Enrôler l'utilisateur auprès de l'autorité de certification (CA)
    const enrollment = await ca.enroll({ enrollmentID: enrollID, enrollmentSecret: enrollSecret });
    const identity: X509Identity = {
      credentials: {
        certificate: enrollment.certificate,
        privateKey: enrollment.key.toBytes(),
      },
      mspId: 'org1-insurance-com',  // S'assurer que mspId est correctement configuré
      type: 'X.509',
    };

    // Ajouter l'identité de l'utilisateur dans le wallet avec le bon format
    await wallet.put(enrollID, identity);
    console.log(`L'utilisateur ${enrollID} a été enrôlé avec succès et ajouté au wallet.`);
    return true;

  } catch (error) {
    console.error(`Erreur lors de l'authentification de l'utilisateur ${enrollID}: ${error}`);
    return false;
  }
}

app.post('/api/addEncryptedTripData', verifyToken, async (req: Request, res: Response) => {
  try {
    const { contract } = await initContract(req.wallet!, req.enrollID!);
    const { vehID, tripID, date, speeding, hard_accelerations, emergency_brakes, unsafe_distance, high_risk_zones, traffic_signal_compliance, night_driving, mileage } = req.body;

    const result = await contract.submitTransaction('addEncryptedTripData', vehID, tripID, date, speeding, hard_accelerations, emergency_brakes, unsafe_distance, high_risk_zones, traffic_signal_compliance, night_driving, mileage );
    res.json({ success: true, message: 'Encrypted trip successfully added.', result: result.toString() });
  } catch (error) {
    console.error(`Erreur lors de l'ajout du trajet: ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors de l\'ajout du trajet encrypté.' });
  }
});



app.post('/api/addVerifier', verifyToken, async (req: Request, res: Response) => {
  try {
    const { contract } = await initContract(req.wallet!, req.enrollID!);
    const { ownerID, n, nsquare } = req.body;

    const result = await contract.submitTransaction('addVerifier', ownerID, n, nsquare);
    res.json({ success: true, message: 'Verifier ajouté avec succès.', result: result.toString() });
  } catch (error) {
    console.error(`Erreur lors de l'ajout du vérificateur: ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors de l\'ajout du vérificateur.' });
  }
});

app.post('/api/addEncryptedVehicleData', verifyToken, async (req: Request, res: Response) => {
  try {
    const { contract } = await initContract(req.wallet!, req.enrollID!);
    const { vehicleID, age, vehicleType, purchaseMileage, year } = req.body;

    const result = await contract.submitTransaction(
      'addEncryptedVehicleData',
      vehicleID,
      age.toString(),
      vehicleType.toString(),
      purchaseMileage.toString(),
      year.toString()
    );
    res.json({ success: true, message: 'Données de véhicule chiffrées ajoutées avec succès.', result: result.toString() });
  } catch (error) {
    console.error(`Erreur lors de l'ajout des données de véhicule: ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors de l\'ajout des données de véhicule.' });
  }
});

app.post('/api/addEncryptedTripData', verifyToken, async (req: Request, res: Response) => {
  try {
    const { contract } = await initContract(req.wallet!, req.enrollID!);
    const {
      vehicleID,
      tripID,
      date,
      speeding,
      hardAccelerations,
      emergencyBrakes,
      unsafeDistance,
      highRiskZones,
      trafficSignalCompliance,
      nightDriving,
      mileage,
    } = req.body;

    const result = await contract.submitTransaction(
      'addEncryptedTripData',
      vehicleID,
      tripID,
      date,
      speeding.toString(),
      hardAccelerations.toString(),
      emergencyBrakes.toString(),
      unsafeDistance.toString(),
      highRiskZones.toString(),
      trafficSignalCompliance.toString(),
      nightDriving.toString(),
      mileage.toString()
    );

    res.json({ success: true, message: 'Données de trajet chiffrées ajoutées avec succès.', result: result.toString() });
  } catch (error) {
    console.error(`Erreur lors de l'ajout des données de trajet: ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors de l\'ajout des données de trajet.' });
  }
});

app.post('/api/addUser', verifyToken, async (req: Request, res: Response) => {
  try {
    const { authcontract } = await initContract(req.wallet!, req.enrollID!);

    // Les données envoyées dans la requête
    const { name, password, role, dateofbirth, address } = req.body;

    if (!name || !password || !role || !dateofbirth || !address) {
      res.status(400).json({ error: 'Tous les champs (name, password, role, dateofbirth, address) sont obligatoires.' });
      return;
    }

    // Soumission de la transaction au smart contract
    const result = await authcontract.submitTransaction('register', name, password, role, dateofbirth, address);

    res.json({ success: true, message: 'Utilisateur ajouté avec succès.', result: result.toString() });
  } catch (error) {
    console.error(`Erreur lors de l'ajout de l'utilisateur : ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors de l\'ajout de l\'utilisateur.' });
  }
});

app.post('/api/addVehicleData', verifyToken, async (req: Request, res: Response) => {
  try {
    const { contract } = await initContract(req.wallet!, req.enrollID!);

    // Récupération des données envoyées dans la requête
    const { vehicleID, vehicle_type, purchase_mileage, year, ownerID } = req.body;

    // Vérification que tous les champs sont présents
    if (!vehicleID || !vehicle_type || !purchase_mileage || !year || !ownerID) {
      res.status(400).json({ error: 'Tous les champs (vehicleID, age, vehicleType, purchaseMileage, year, verifierOwnerID) sont obligatoires.' });
      return;
    }

    // Soumission de la transaction au smart contract
    const result = await contract.submitTransaction(
      'addEncryptedVehicleData',
      vehicleID,
      vehicle_type.toString(),
      purchase_mileage.toString(),
      year.toString(),
      ownerID
    );

    res.json({ success: true, message: 'Données du véhicule ajoutées avec succès.', result: result.toString() });
  } catch (error) {
    console.error(`Erreur lors de l'ajout des données du véhicule : ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors de l\'ajout des données du véhicule.' });
  }
});


app.post('/api/calculateInsurancePremium', verifyToken, async (req: Request, res: Response) => {
  try {
    const { contract } = await initContract(req.wallet!, req.enrollID!);
    const { vehicleID, tripID, criteriaWeightsID } = req.body;

    const calculationResult = await contract.submitTransaction(
      'calculateInsurancePremium',
      vehicleID,
      tripID,
      criteriaWeightsID
    );
    res.json({ 
      success: true, 
      message: 'Calcul de la prime réalisé avec succès.', 
      result: JSON.parse(calculationResult.toString()) 
    });
  } catch (error) {
    console.error(`Erreur lors du calcul de la prime: ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors du calcul de la prime.' });
  }
});

app.post('/api/changePassword/:ownerID', verifyToken, async (req: Request, res: Response) => {
  try {
    const { authcontract } = await initContract(req.wallet!, req.enrollID!);

    // Récupérer les données de la requête
    const ownerID = req.params.ownerID;
    console.log(ownerID)
    const { currentPassword, newPassword } = req.body;

    if (!ownerID || !currentPassword || !newPassword) {
      res.status(400).json({ error: 'ownerID, currentPassword et newPassword sont obligatoires.' });
      return;
    }

    // Hachage des mots de passe
    const hashedCurrentPassword = crypto.createHash('sha256').update(currentPassword).digest('hex');
    const hashedNewPassword = crypto.createHash('sha256').update(newPassword).digest('hex');

    // Appeler le smart contract pour changer le mot de passe
    const result = await authcontract.submitTransaction('changePassword', ownerID, hashedCurrentPassword, hashedNewPassword);

    res.json({ success: true, message: 'Mot de passe changé avec succès.', result: result.toString() });
  } catch (error) {
    console.error(`Erreur lors du changement de mot de passe pour ${req.params.ownerID}: ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors du changement de mot de passe.' });
  }
});





app.post('/api/decryptInsurancePremiumAndUpdate', verifyToken, async (req: Request, res: Response) => {
  try {
    console.log("got into it")
    const { contract } = await initContract(req.wallet!, req.enrollID!);
    const { resultID, rPrime } = req.body;
    console.log(resultID)
    console.log(rPrime)
    const decryptResult = await contract.submitTransaction(
      'decryptInsurancePremiumAndUpdate',
      resultID,
      rPrime
    );
    console.log("transaction submitted")
    res.json({ 
      success: true, 
      message: 'Successful deciphering and updating of premiums.', 
      result: JSON.parse(decryptResult.toString()) 
    });
  } catch (error) {
    console.error(`Erreur lors du décryptage et de la mise à jour de la prime: ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors du décryptage de la prime.' });
  }
});

app.get('/api/queryTripsByVehicleID/:vehicleID', verifyToken, async (req: Request, res: Response) => {
  try {
    const { contract } = await initContract(req.wallet!, req.enrollID!);
    const vehicleID = req.params.vehicleID;
    console.log(vehicleID)

    // Appeler la fonction `queryTripsByVehicleID` du smart contract
    const result = await contract.evaluateTransaction('queryTripsByVehicleID', vehicleID);

    // Retourner les trips dans le même format que `queryVehicleData`
    res.json({ success: true, data: JSON.parse(result.toString()) });
  } catch (error) {
    console.error(`Erreur lors de la récupération des trajets pour VehicleID ${req.params.vehicleID}: ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération des trajets.' });
  }
});

app.get('/api/queryPrimesByVehicleID/:vehicleID', verifyToken, async (req: Request, res: Response) => {
  try {
    const { contract } = await initContract(req.wallet!, req.enrollID!);
    const vehicleID = req.params.vehicleID;

    // Appel de la fonction du smart contract pour récupérer les primes
    const result = await contract.evaluateTransaction('queryPrimesByVehicleID', vehicleID);

    // Retourner les primes sous forme de JSON
    res.json({ success: true, primes: JSON.parse(result.toString()) });
  } catch (error) {
    console.error(`Erreur lors de la récupération des primes pour VehicleID ${req.params.vehicleID}: ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération des primes.' });
  }
});

// Endpoint pour récupérer tous les résultats de calculs chiffrés liés aux trips d'un véhicule
app.get('/api/queryEncryptedResultsByVehicleID/:vehicleID', verifyToken, async (req: Request, res: Response) => {
  try {
    const { contract } = await initContract(req.wallet!, req.enrollID!);
    const vehicleID = req.params.vehicleID;

    // Appel de la fonction du smart contract pour récupérer les résultats chiffrés
    const result = await contract.evaluateTransaction('queryEncryptedCalculationResultsByVehicleID', vehicleID);

    // Retourner les résultats sous forme de JSON
    res.json({ success: true, encryptedResults: JSON.parse(result.toString()) });
  } catch (error) {
    console.error(`Erreur lors de la récupération des résultats chiffrés pour VehicleID ${req.params.vehicleID}: ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération des résultats chiffrés.' });
  }
});

app.get('/api/queryVehicleData/:vehicleID', verifyToken, async (req: Request, res: Response) => {
  try {
    const { contract } = await initContract(req.wallet!, req.enrollID!);
    const vehicleID = req.params.vehicleID;

    const result = await contract.evaluateTransaction('queryVehicleData', vehicleID);
    res.json({ success: true, data: JSON.parse(result.toString()) });
  } catch (error) {
    console.error(`Erreur lors de la récupération des données de véhicule: ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération des données de véhicule.' });
  }
});

app.get('/api/addEncryptedVehicleData/:vehicleID', verifyToken, async (req: Request, res: Response) => {
  try {
    const { contract } = await initContract(req.wallet!, req.enrollID!);
    const vehicleID = req.params.vehicleID;

    const result = await contract.evaluateTransaction('addEncryptedVehicleData', vehicleID);
    res.json({ success: true, data: JSON.parse(result.toString()) });
  } catch (error) {
    console.error(`Erreur lors de la récupération des données de véhicule: ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération des données de véhicule.' });
  }
});

app.get('/api/queryVerifier/:ownerID', verifyToken, async (req: Request, res: Response) => {
  try {
    // Initialiser le contrat avec le wallet de l'utilisateur
    const { contract } = await initContract(req.wallet!, req.enrollID!);
    const ownerID = req.params.ownerID;

    // Appel de la méthode 'queryVerifier' du smart contract
    const result = await contract.evaluateTransaction('queryVerifier', ownerID);

    // Retourner le résultat au frontend
    res.json({ success: true, data: JSON.parse(result.toString()) });
  } catch (error) {
    console.error(`Erreur lors de la vérification du vérificateur pour ${req.params.ownerID}: ${error}`);
    res.status(500).json({ error: 'Aucune clé trouvée pour cet utilisateur ou une erreur est survenue.' });
  }
});


app.get('/api/queryTrips/:vehicleID', verifyToken, async (req: Request, res: Response) => {
  try {
    const { contract } = await initContract(req.wallet!, req.enrollID!);
    const vehicleID = req.params.vehicleID;

    const result = await contract.evaluateTransaction('queryTrips', vehicleID); // Assurez-vous que votre smart contract supporte cette fonction.
    res.json({ success: true, trips: JSON.parse(result.toString()) });
  } catch (error) {
    console.error(`Erreur lors de la récupération des trajets: ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération des trajets.' });
  }
});

app.get('/api/queryMonthPrime/:vehicleID/:month/:year', verifyToken, async (req: Request, res: Response) => {
  try {
    const { contract } = await initContract(req.wallet!, req.enrollID!);
    const { vehicleID, month, year } = req.params;

    const result = await contract.evaluateTransaction('queryMonthPrime', vehicleID, month, year);
    res.json({ success: true, monthPrime: JSON.parse(result.toString()) });
  } catch (error) {
    console.error(`Erreur lors de la récupération de la prime mensuelle: ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération de la prime mensuelle.' });
  }
});

app.get('/api/queryPrime/:tripID', verifyToken, async (req: Request, res: Response) => { 
  try {
    const { contract } = await initContract(req.wallet!, req.enrollID!);
    const tripID = req.params.tripID;

    const result = await contract.evaluateTransaction('queryPrime', tripID);
    res.json({ success: true, prime: JSON.parse(result.toString()) });
  } catch (error) {
    console.error(`Erreur lors de la récupération de la prime associée au trajet: ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération de la prime.' });
  }
});

app.get('/api/queryEncryptedCalculationResult/:tripID', verifyToken, async (req: Request, res: Response) => { 
  try {
    const { contract } = await initContract(req.wallet!, req.enrollID!);
    const resultID = req.params.resultID;

    const result = await contract.evaluateTransaction('queryEncryptedCalculationResult', resultID);
    res.json({ success: true, prime: JSON.parse(result.toString()) });
  } catch (error) {
    console.error(`Erreur lors de la récupération de la prime chiffrée: ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération de la prime chiffrée.' });
  }
});

app.get('/api/queryOwnerDetails/:ownerID', verifyToken, async (req: Request, res: Response) => {
  try {
    const { contract } = await initContract(req.wallet!, req.enrollID!);
    const ownerID = req.params.ownerID;

    // Appel de la méthode 'queryOwnerDetails' du smart contract
    const result = await contract.evaluateTransaction('queryOwnerDetails', ownerID);
    console.log()
    // Retourner le résultat sous forme JSON
    res.json({ success: true, data: JSON.parse(result.toString()) });
  } catch (error) {
    console.error(`Erreur lors de la récupération des détails du propriétaire : ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération des détails du propriétaire.' });
  }
});

app.get('/api/queryAllCriteriaWeights', verifyToken, async (req: Request, res: Response) => {
  try {
    const { contract } = await initContract(req.wallet!, req.enrollID!);

    const result = await contract.evaluateTransaction('queryAllCriteriaWeights');
    res.json({ success: true, data: JSON.parse(result.toString()) });
  } catch (error) {
    console.error(`Erreur lors de la récupération de tous les CriteriaWeights: ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération de tous les CriteriaWeights.' });
  }
});

app.get('/api/getAllClientDetails', verifyToken, async (req: Request, res: Response) => {
  try {
    // Initialiser le contrat avec le wallet de l'utilisateur
    const { authcontract, contract } = await initContract(req.wallet!, req.enrollID!);

    // Appel de la fonction `getClients` pour récupérer les utilisateurs "client"
    const clientsResult = await authcontract.evaluateTransaction('getClients');
    const clients = JSON.parse(clientsResult.toString());

    const allClientDetails = [];

    // Parcourir chaque client pour récupérer les détails du propriétaire
    console.log(clients);
    for (const client of clients) {
      const ownerID = client.name; // On suppose que le `name` correspond à l'ownerID

      // Appel de `queryOwnerDetails` pour chaque utilisateur
      const ownerDetailsResult = await contract.evaluateTransaction('queryOwnerDetails', ownerID);
      const ownerDetails = JSON.parse(ownerDetailsResult.toString());

      // Fusionner les détails dans le client
      const clientWithDetails = {
        ...client,
        infos: ownerDetails,
      };

      // Ajouter le client enrichi à la liste
      allClientDetails.push(clientWithDetails);
    }
    
    res.json({ success: true, allClientDetails });
  } catch (error) {
    console.error(`Erreur lors de la récupération des détails des clients : ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération des détails des clients.' });
  }
});

app.post('/api/addInsuranceContract', verifyToken, async (req: Request, res: Response) => {
  try {
    const { contract } = await initContract(req.wallet!, req.enrollID!);
    const {
      contractID,
      ownerID,
      vehicleID,
      criteriaWeightsID,
      startMonth,
      startYear,
      endMonth,
      endYear,
    } = req.body;

    const result = await contract.submitTransaction(
      'addInsuranceContract',
      contractID,
      ownerID,
      vehicleID,
      criteriaWeightsID,
      startMonth.toString(),
      startYear.toString(),
      endMonth.toString(),
      endYear.toString()
    );

    res.json({ success: true, message: 'Contrat d\'assurance ajouté avec succès.', result: result.toString() });
  } catch (error) {
    console.error(`Erreur lors de l'ajout du contrat d'assurance: ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors de l\'ajout du contrat d\'assurance.' });
  }
});

app.post('/api/addCriteriaWeight', verifyToken, async (req: Request, res: Response) => {
  try {
    const { contract } = await initContract(req.wallet!, req.enrollID!);
    const {
      criteriaWeightsID,
      weightTraffic,
      weightSpeed,
      weightAcceleration,
      weightBraking,
      weightDistance,
      weightZone,
      weightTime,
      alpha,
      beta,
    } = req.body;

    const result = await contract.submitTransaction(
      'addCriteriaWeights',
      criteriaWeightsID,
      weightTraffic.toString(),
      weightSpeed.toString(),
      weightAcceleration.toString(),
      weightBraking.toString(),
      weightDistance.toString(),
      weightZone.toString(),
      weightTime.toString(),
      alpha.toString(),
      beta.toString()
    );

    res.json({ success: true, message: 'Critères de pondération ajoutés avec succès.', result: result.toString() });
  } catch (error) {
    console.error(`Erreur lors de l'ajout des critères de pondération: ${error}`);
    res.status(500).json({ error: 'Une erreur est survenue lors de l\'ajout des critères de pondération.' });
  }
});




// Démarrer le serveur
app.listen(port, () => {
  console.log(`Backend API en cours d'exécution sur le port ${port}`);
});
