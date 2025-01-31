package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"strconv"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

// SmartContract structure
type SmartContract struct{}

// InsuranceContract représente un contrat d'assurance
type InsuranceContract struct {
	ContractID        string `json:"contractID"`        // Identifiant unique du contrat
	OwnerID           string `json:"ownerID"`           // Identifiant du propriétaire
	VehicleID         string `json:"vehicleID"`         // Identifiant du véhicule
	CriteriaWeightsID string `json:"criteriaWeightsID"` // Identifiant des critères de pondération
	StartMonth        int    `json:"startMonth"`        // Mois de début
	StartYear         int    `json:"startYear"`         // Année de début
	EndMonth          int    `json:"endMonth"`          // Mois de fin
	EndYear           int    `json:"endYear"`           // Année de fin
}

// Decryptor représente une instance Decryptor
type Decryptor struct {
	P       string `json:"p"`
	Q       string `json:"q"`
	N       string `json:"n"`
	Lambda  string `json:"lambda"`
	OwnerID string `json:"ownerID"`
}

// Verifier représente une instance Verifier
type Verifier struct {
	N       string `json:"n"`
	NSquare string `json:"nsquare"`
	OwnerID string `json:"ownerID"`
}

// EncryptedVehicleData représente les données du véhicule chiffrées
type EncryptedVehicleData struct {
	VehicleID       string   `json:"vehicleID"`        // Identifiant unique du véhicule
	VehicleType     *big.Int `json:"vehicle_type"`     // Chiffré
	PurchaseMileage *big.Int `json:"purchase_mileage"` // Chiffré
	Year            *big.Int `json:"year"`             // Chiffré
	OwnerID         string   `json:"ownerID"`
}

// EncryptedTripData représente les données d'un trajet chiffrées
type EncryptedTripData struct {
	VehicleID               string   `json:"vehicleID"`                 // Identifiant du véhicule
	TripID                  string   `json:"tripID"`                    // Identifiant unique du trajet
	Date                    string   `json:"date"`                      // Date du trajet (format ISO 8601 : YYYY-MM-DD)
	Speeding                *big.Int `json:"speeding"`                  // Chiffré
	HardAccelerations       *big.Int `json:"hard_accelerations"`        // Chiffré
	EmergencyBrakes         *big.Int `json:"emergency_brakes"`          // Chiffré
	UnsafeDistance          *big.Int `json:"unsafe_distance"`           // Chiffré
	HighRiskZones           *big.Int `json:"high_risk_zones"`           // Chiffré
	TrafficSignalCompliance *big.Int `json:"traffic_signal_compliance"` // Chiffré
	NightDriving            *big.Int `json:"night_driving"`             // Chiffré
	Mileage                 *big.Int `json:"mileage"`                   // Chiffré
}

// CriteriaWeights représente les poids des critères
type CriteriaWeights struct {
	CriteriaWeightsID  string `json:"criteriaweightID"`
	WeightTraffic      int    `json:"weight_traffic"`
	WeightSpeed        int    `json:"weight_speed"`
	WeightAcceleration int    `json:"weight_acceleration"`
	WeightBraking      int    `json:"weight_braking"`
	WeightDistance     int    `json:"weight_distance"`
	WeightZone         int    `json:"weight_zone"`
	WeightTime         int    `json:"weight_time"`
	Alpha              int    `json:"alpha"` // Scalaire pour PAYD
	Beta               int    `json:"beta"`  // Scalaire pour PHYD
}

// MonthPrime représente la prime mensuelle associée à un véhicule
type MonthPrime struct {
	VehicleID string `json:"vehicleID"` // Identifiant unique du véhicule
	Month     int    `json:"month"`     // Mois (1-12)
	Year      int    `json:"year"`      // Année (format YYYY)
	Prime     int    `json:"month_prime"`
}

// Prime représente la prime associée à un trajet
type Prime struct {
	TripID string `json:"tripID"` // Identifiant unique du trajet
	Date   string `json:"date"`   // Date du calcul (format ISO 8601 : YYYY-MM-DD)
	Prime  int    `json:"prime"`  // Valeur de la prime
}

type EncryptedCalculationResult struct {
	ResultID    string   `json:"resultID"`
	PrimeTotale *big.Int `json:"prime_totale"` // Chiffré
	R           *big.Int `json:"r"`            // Calculé pour décryptage
	TripID      string   `json:"tripID"`
}

// Init initialise le contrat
func (s *SmartContract) Init(stub shim.ChaincodeStubInterface) pb.Response {
	fmt.Println("Smart Contract Initialized")
	return shim.Success(nil)
}

// Invoke redirige les appels vers les fonctions appropriées
func (s *SmartContract) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	fn, args := stub.GetFunctionAndParameters()
	fmt.Printf("Invoke function: %s\n", fn)
	switch fn {
	case "addDecryptor":
		return s.addDecryptor(stub, args)
	case "addVerifier":
		return s.addVerifier(stub, args)
	case "queryDecryptor":
		return s.queryDecryptor(stub, args)
	case "queryVerifier":
		return s.queryVerifier(stub, args)
	case "encrypt":
		return s.TestEncryption(stub, args)
	case "addCriteriaWeights":
		return s.addCriteriaWeights(stub, args)
	case "addEncryptedVehicleData":
		return s.addEncryptedVehicleData(stub, args)
	case "addEncryptedTripData":
		return s.addEncryptedTripData(stub, args)
	case "addVehicleData":
		return s.addVehicleData(stub, args)
	case "addTripData":
		return s.addTripData(stub, args)
	case "addMonthPrime":
		return s.addMonthPrime(stub, args)
	case "calculateInsurancePremium":
		return s.CalculateInsurancePremium(stub, args)
	case "queryVehicleData":
		return s.queryVehicleData(stub, args)
	case "addOwnerToVehicleData":
		return s.addOwnerToVehicleData(stub, args)
	case "decryptInsurancePremiumAndUpdate":
		return s.decryptInsurancePremiumAndUpdate(stub, args)
	case "queryEncryptedCalculationResult":
		return s.queryEncryptedCalculationResult(stub, args)
	case "queryTripsByVehicleID":
		return s.queryTripsByVehicleID(stub, args)
	case "decryptInsurancePremiumAndUpdateWithoutParams":
		return s.decryptInsurancePremiumAndUpdateWithoutParams(stub, args)
	case "TestCalculateAndDecryptInsurancePremium":
		return s.TestCalculateAndDecryptInsurancePremium(stub, args)
	case "queryPrime":
		return s.queryPrime(stub, args)
	case "queryMonthPrime":
		return s.queryMonthPrime(stub, args)
	case "queryTripData":
		return s.queryTripData(stub, args)
	case "queryInsuranceContractsByOwner":
		return s.queryInsuranceContractsByOwner(stub, args)
	case "addInsuranceContract":
		return s.addInsuranceContract(stub, args)
	case "queryInsuranceContract":
		return s.queryInsuranceContract(stub, args)
	case "queryOwnerDetails":
		return s.queryOwnerDetails(stub, args)
	case "queryCriteriaWeights":
		return s.queryCriteriaWeights(stub, args)
	case "queryMultipleOwnerDetails":
		return s.queryMultipleOwnerDetails(stub, args)
	case "queryPrimesByVehicleID":
		return s.queryPrimesByVehicleID(stub, args)
	case "queryEncryptedCalculationResultsByVehicleID":
		return s.queryEncryptedCalculationResultsByVehicleID(stub, args)
	case "queryAllCriteriaWeights":
		return s.queryAllCriteriaWeights(stub)
	case "queryAllInsuranceContracts":
		return s.queryAllInsuranceContracts(stub)
	case "queryVehiclesByOwner":
		return s.queryVehiclesByOwner(stub, args)
	case "deleteVerifier":
		return s.deleteVerifier(stub, args)
	case "deleteEncryptedTripData":
		return s.deleteEncryptedTripData(stub, args)
	case "removeAgeFromEncryptedVehicleData":
		return s.removeAgeFromEncryptedVehicleData(stub)
	default:
		return shim.Error("Invalid function name. Valid functions: 'addDecryptor', 'addVerifier', 'queryDecryptor', 'queryVerifier', 'encrypt', 'addCriteriaWeights', 'addEncryptedVehicleData', 'addEncryptedTripData', 'addVehicleData', 'addTripData', 'addMonthPrime', 'calculateInsurancePremium'")
	}
}

func (s *SmartContract) addInsuranceContract(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	// Vérification du nombre d'arguments
	if len(args) != 8 {
		return shim.Error("Incorrect number of arguments. Expecting 8: ContractID, OwnerID, VehicleID, CriteriaWeightsID, StartMonth, StartYear, EndMonth, EndYear")
	}

	// Extraction des arguments
	contractID := args[0]
	ownerID := args[1]
	vehicleID := args[2]
	criteriaWeightsID := args[3]
	startMonth := toInt(args[4])
	startYear := toInt(args[5])
	endMonth := toInt(args[6])
	endYear := toInt(args[7])

	// Vérifiez si le contrat existe déjà
	contractKey := "contract_" + contractID
	existingContract, err := stub.GetState(contractKey)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to check existing contract: %s", err.Error()))
	}
	if existingContract != nil {
		return shim.Error("Contract with the given ContractID already exists")
	}

	// Création du contrat
	contract := InsuranceContract{
		ContractID:        contractID,
		OwnerID:           ownerID,
		VehicleID:         vehicleID,
		CriteriaWeightsID: criteriaWeightsID,
		StartMonth:        startMonth,
		StartYear:         startYear,
		EndMonth:          endMonth,
		EndYear:           endYear,
	}

	// Sérialisation du contrat en JSON
	contractBytes, err := json.Marshal(contract)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to marshal InsuranceContract: %s", err.Error()))
	}

	// Stockage du contrat dans le ledger
	err = stub.PutState(contractKey, contractBytes)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to store InsuranceContract: %s", err.Error()))
	}

	fmt.Printf("InsuranceContract with ContractID %s added successfully\n", contractID)
	return shim.Success(nil)
}

// addDecryptor ajoute une instance Decryptor au réseau
func (s *SmartContract) addDecryptor(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 5 {
		return shim.Error("Incorrect number of arguments. Expecting 5: OwnerID, P, Q, N, Lambda")
	}

	decryptor := Decryptor{
		OwnerID: args[0],
		P:       args[1],
		Q:       args[2],
		N:       args[3],
		Lambda:  args[4],
	}

	decryptorJSON, err := json.Marshal(decryptor)
	if err != nil {
		return shim.Error("Failed to marshal Decryptor to JSON")
	}

	err = stub.PutState("decryptor_"+decryptor.OwnerID, decryptorJSON)
	if err != nil {
		return shim.Error("Failed to store Decryptor")
	}

	fmt.Printf("Decryptor for OwnerID %s added successfully\n", decryptor.OwnerID)
	return shim.Success(nil)
}

// addVerifier ajoute une instance Verifier au réseau
func (s *SmartContract) addVerifier(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 3 {
		return shim.Error("Incorrect number of arguments. Expecting 3: OwnerID, N, NSquare")
	}

	ownerID := args[0]

	// Vérifiez si un Verifier existe déjà pour cet OwnerID
	key := "verifier_" + ownerID
	existingVerifier, err := stub.GetState(key)
	if err != nil {
		return shim.Error("Failed to check existing Verifier")
	}

	if existingVerifier != nil {
		return shim.Error("Verifier with this OwnerID already exists")
	}

	verifier := Verifier{
		OwnerID: ownerID,
		N:       args[1],
		NSquare: args[2],
	}

	verifierJSON, err := json.Marshal(verifier)
	if err != nil {
		return shim.Error("Failed to marshal Verifier to JSON")
	}

	err = stub.PutState(key, verifierJSON)
	if err != nil {
		return shim.Error("Failed to store Verifier")
	}

	fmt.Printf("Verifier for OwnerID %s added successfully\n", ownerID)
	return shim.Success(nil)
}

func (s *SmartContract) addEncryptedVehicleData(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 5 {
		return shim.Error("Incorrect number of arguments. Expecting 5: VehicleID, VehicleType, PurchaseMileage, Year, verifierOwnerID")
	}

	vehicleID := args[0]
	verifierOwnerID := args[4]

	verifierKey := "verifier_" + verifierOwnerID
	verifierBytes, err := stub.GetState(verifierKey)
	if err != nil || verifierBytes == nil {
		return shim.Error("Verifier not found for the given OwnerID")
	}

	// Vérifiez si les données du véhicule existent déjà
	key := "vehicle_" + vehicleID
	existingVehicle, err := stub.GetState(key)
	if err != nil {
		return shim.Error("Failed to check existing vehicle data")
	}

	if existingVehicle != nil {
		return shim.Error("Vehicle data with this VehicleID already exists")
	}

	vehicleType, ok := new(big.Int).SetString(args[1], 10)
	if !ok {
		return shim.Error("Failed to convert VehicleType to *big.Int")
	}

	purchaseMileage, ok := new(big.Int).SetString(args[2], 10)
	if !ok {
		return shim.Error("Failed to convert PurchaseMileage to *big.Int")
	}

	year, ok := new(big.Int).SetString(args[3], 10)
	if !ok {
		return shim.Error("Failed to convert Year to *big.Int")
	}

	encryptedVehicleData := EncryptedVehicleData{
		VehicleID:       vehicleID,
		VehicleType:     vehicleType,
		PurchaseMileage: purchaseMileage,
		Year:            year,
		OwnerID:         verifierOwnerID,
	}

	vehicleJSON, err := json.Marshal(encryptedVehicleData)
	if err != nil {
		return shim.Error("Failed to marshal EncryptedVehicleData to JSON")
	}

	err = stub.PutState(key, vehicleJSON)
	if err != nil {
		return shim.Error("Failed to store EncryptedVehicleData")
	}

	fmt.Printf("EncryptedVehicleData for VehicleID %s added successfully\n", vehicleID)
	return shim.Success(nil)
}

func (s *SmartContract) addEncryptedTripData(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 11 {
		return shim.Error("Incorrect number of arguments. Expecting 11: VehicleID, TripID, Date, Speeding, HardAccelerations, EmergencyBrakes, UnsafeDistance, HighRiskZones, TrafficSignalCompliance, NightDriving, Mileage")
	}

	vehicleID := args[0]
	tripID := args[1]

	// Vérifiez si les données du trajet existent déjà
	key := "trip_" + tripID
	existingTrip, err := stub.GetState(key)
	if err != nil {
		return shim.Error("Failed to check existing trip data")
	}

	if existingTrip != nil {
		return shim.Error("Trip data with this TripID already exists")
	}

	speeding, ok := new(big.Int).SetString(args[3], 10)
	if !ok {
		return shim.Error("Failed to convert Speeding to *big.Int")
	}

	hardAccelerations, ok := new(big.Int).SetString(args[4], 10)
	if !ok {
		return shim.Error("Failed to convert HardAccelerations to *big.Int")
	}

	emergencyBrakes, ok := new(big.Int).SetString(args[5], 10)
	if !ok {
		return shim.Error("Failed to convert EmergencyBrakes to *big.Int")
	}

	unsafeDistance, ok := new(big.Int).SetString(args[6], 10)
	if !ok {
		return shim.Error("Failed to convert UnsafeDistance to *big.Int")
	}

	highRiskZones, ok := new(big.Int).SetString(args[7], 10)
	if !ok {
		return shim.Error("Failed to convert HighRiskZones to *big.Int")
	}

	trafficSignalCompliance, ok := new(big.Int).SetString(args[8], 10)
	if !ok {
		return shim.Error("Failed to convert TrafficSignalCompliance to *big.Int")
	}

	nightDriving, ok := new(big.Int).SetString(args[9], 10)
	if !ok {
		return shim.Error("Failed to convert NightDriving to *big.Int")
	}

	mileage, ok := new(big.Int).SetString(args[10], 10)
	if !ok {
		return shim.Error("Failed to convert Mileage to *big.Int")
	}

	encryptedTripData := EncryptedTripData{
		VehicleID:               vehicleID,
		TripID:                  tripID,
		Date:                    args[2],
		Speeding:                speeding,
		HardAccelerations:       hardAccelerations,
		EmergencyBrakes:         emergencyBrakes,
		UnsafeDistance:          unsafeDistance,
		HighRiskZones:           highRiskZones,
		TrafficSignalCompliance: trafficSignalCompliance,
		NightDriving:            nightDriving,
		Mileage:                 mileage,
	}

	tripJSON, err := json.Marshal(encryptedTripData)
	if err != nil {
		return shim.Error("Failed to marshal EncryptedTripData to JSON")
	}

	err = stub.PutState(key, tripJSON)
	if err != nil {
		return shim.Error("Failed to store EncryptedTripData")
	}

	fmt.Printf("EncryptedTripData for TripID %s added successfully\n", tripID)
	return shim.Success(nil)
}

func (s *SmartContract) addVehicleData(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 5 {
		return shim.Error("Incorrect number of arguments. Expecting 5: VehicleID, VehicleType, PurchaseMileage, Year, VerifierOwnerID")
	}

	vehicleID := args[0]
	verifierOwnerID := args[5]

	// Charger l'instance Verifier associée à l'OwnerID
	verifierKey := "verifier_" + verifierOwnerID
	verifierBytes, err := stub.GetState(verifierKey)
	if err != nil || verifierBytes == nil {
		return shim.Error("Verifier not found for the given OwnerID")
	}

	var verifier Verifier
	err = json.Unmarshal(verifierBytes, &verifier)
	if err != nil {
		return shim.Error("Failed to unmarshal Verifier")
	}

	// Convertir N en *big.Int
	n := new(big.Int)
	n.SetString(verifier.N, 10)

	// Générer r déterministe basé sur des données spécifiques
	uniqueData := vehicleID + args[1] + args[2] + args[3] + args[4]
	r := generateDeterministicR(uniqueData, n)

	vehicleType, ok := new(big.Int).SetString(args[1], 10)
	if !ok {
		return shim.Error("Failed to convert VehicleType to *big.Int")
	}
	encryptedVehicleType, err := verifier.EncryptWithCustomRandom(vehicleType, r)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to encrypt VehicleType: %s", err))
	}

	purchaseMileage, ok := new(big.Int).SetString(args[2], 10)
	if !ok {
		return shim.Error("Failed to convert PurchaseMileage to *big.Int")
	}
	encryptedPurchaseMileage, err := verifier.EncryptWithCustomRandom(purchaseMileage, r)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to encrypt PurchaseMileage: %s", err))
	}

	year, ok := new(big.Int).SetString(args[3], 10)
	if !ok {
		return shim.Error("Failed to convert Year to *big.Int")
	}
	encryptedYear, err := verifier.EncryptWithCustomRandom(year, r)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to encrypt Year: %s", err))
	}

	// Créer l'actif EncryptedVehicleData
	encryptedVehicleData := EncryptedVehicleData{
		VehicleID:       vehicleID,
		VehicleType:     encryptedVehicleType,
		PurchaseMileage: encryptedPurchaseMileage,
		Year:            encryptedYear,
		OwnerID:         verifierOwnerID,
	}

	vehicleJSON, err := json.Marshal(encryptedVehicleData)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to marshal EncryptedVehicleData: %s", err))
	}

	// Enregistrer l'actif dans le ledger
	key := "vehicle_" + vehicleID
	err = stub.PutState(key, vehicleJSON)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to store EncryptedVehicleData: %s", err))
	}

	fmt.Printf("EncryptedVehicleData for VehicleID %s added successfully\n", vehicleID)
	return shim.Success(nil)
}

func (s *SmartContract) addTripData(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 12 {
		return shim.Error("Incorrect number of arguments. Expecting 12: VehicleID, TripID, Date, Speeding, HardAccelerations, EmergencyBrakes, UnsafeDistance, HighRiskZones, TrafficSignalCompliance, NightDriving, Mileage, VerifierOwnerID")
	}

	const scaleFactor = 1 // Échelle pour convertir les décimales en entiers
	vehicleID := args[0]
	tripID := args[1]
	date := args[2]
	verifierOwnerID := args[11]

	// Charger l'instance Verifier associée à l'OwnerID
	verifierKey := "verifier_" + verifierOwnerID
	verifierBytes, err := stub.GetState(verifierKey)
	if err != nil || verifierBytes == nil {
		return shim.Error("Verifier not found for the given OwnerID")
	}

	var verifier Verifier
	err = json.Unmarshal(verifierBytes, &verifier)
	if err != nil {
		return shim.Error("Failed to unmarshal Verifier")
	}

	// Convertir N en *big.Int
	n := new(big.Int)
	n.SetString(verifier.N, 10)

	// Générer r déterministe basé sur des données spécifiques
	uniqueData := vehicleID + tripID + date
	r := generateDeterministicR(uniqueData, n)

	// Convertir et chiffrer les données
	toBigInt := func(value string) (*big.Int, error) {
		// Convertir la valeur en flottant
		floatValue, err := strconv.ParseFloat(value, 64)
		if err != nil {
			return nil, fmt.Errorf("failed to parse value '%s': %s", value, err)
		}

		// Appliquer le facteur d'échelle
		scaledValue := int64(floatValue * scaleFactor)

		// Convertir en *big.Int
		return new(big.Int).SetInt64(scaledValue), nil
	}

	speeding, err := toBigInt(args[3])
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to convert Speeding: %s", err))
	}
	encryptedSpeeding, err := verifier.EncryptWithCustomRandom(speeding, r)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to encrypt Speeding: %s", err))
	}

	hardAccelerations, err := toBigInt(args[4])
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to convert HardAccelerations: %s", err))
	}
	encryptedHardAccelerations, err := verifier.EncryptWithCustomRandom(hardAccelerations, r)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to encrypt HardAccelerations: %s", err))
	}

	emergencyBrakes, err := toBigInt(args[5])
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to convert EmergencyBrakes: %s", err))
	}
	encryptedEmergencyBrakes, err := verifier.EncryptWithCustomRandom(emergencyBrakes, r)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to encrypt EmergencyBrakes: %s", err))
	}

	unsafeDistance, err := toBigInt(args[6])
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to convert UnsafeDistance: %s", err))
	}
	encryptedUnsafeDistance, err := verifier.EncryptWithCustomRandom(unsafeDistance, r)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to encrypt UnsafeDistance: %s", err))
	}

	highRiskZones, err := toBigInt(args[7])
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to convert HighRiskZones: %s", err))
	}
	encryptedHighRiskZones, err := verifier.EncryptWithCustomRandom(highRiskZones, r)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to encrypt HighRiskZones: %s", err))
	}

	trafficSignalCompliance, err := toBigInt(args[8])
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to convert TrafficSignalCompliance: %s", err))
	}
	encryptedTrafficSignalCompliance, err := verifier.EncryptWithCustomRandom(trafficSignalCompliance, r)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to encrypt TrafficSignalCompliance: %s", err))
	}

	nightDriving, err := toBigInt(args[9])
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to convert NightDriving: %s", err))
	}
	encryptedNightDriving, err := verifier.EncryptWithCustomRandom(nightDriving, r)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to encrypt NightDriving: %s", err))
	}

	mileage, err := toBigInt(args[10])
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to convert Mileage: %s", err))
	}
	encryptedMileage, err := verifier.EncryptWithCustomRandom(mileage, r)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to encrypt Mileage: %s", err))
	}

	// Créer l'actif EncryptedTripData
	encryptedTripData := EncryptedTripData{
		VehicleID:               vehicleID,
		TripID:                  tripID,
		Date:                    date,
		Speeding:                encryptedSpeeding,
		HardAccelerations:       encryptedHardAccelerations,
		EmergencyBrakes:         encryptedEmergencyBrakes,
		UnsafeDistance:          encryptedUnsafeDistance,
		HighRiskZones:           encryptedHighRiskZones,
		TrafficSignalCompliance: encryptedTrafficSignalCompliance,
		NightDriving:            encryptedNightDriving,
		Mileage:                 encryptedMileage,
	}

	tripJSON, err := json.Marshal(encryptedTripData)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to marshal EncryptedTripData to JSON: %s", err))
	}

	// Enregistrer l'actif dans le ledger
	key := "trip_" + tripID
	err = stub.PutState(key, tripJSON)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to store EncryptedTripData: %s", err))
	}

	fmt.Printf("EncryptedTripData for TripID %s added successfully\n", tripID)
	return shim.Success(nil)
}

// addCriteriaWeights ajoute une instance CriteriaWeights au réseau
func (s *SmartContract) addCriteriaWeights(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 10 {
		return shim.Error("Incorrect number of arguments. Expecting 10: CriteriaWeightsID, WeightTraffic, WeightSpeed, WeightAcceleration, WeightBraking, WeightDistance, WeightZone, WeightTime, Alpha, Beta")
	}

	criteriaWeightsID := args[0]

	// Vérifiez si les poids des critères existent déjà
	key := "criteriaweights_" + criteriaWeightsID
	existingWeights, err := stub.GetState(key)
	if err != nil {
		return shim.Error("Failed to check existing criteria weights")
	}

	if existingWeights != nil {
		return shim.Error("Criteria weights with this ID already exists")
	}

	criteriaWeights := CriteriaWeights{
		CriteriaWeightsID:  criteriaWeightsID,
		WeightTraffic:      toInt(args[1]),
		WeightSpeed:        toInt(args[2]),
		WeightAcceleration: toInt(args[3]),
		WeightBraking:      toInt(args[4]),
		WeightDistance:     toInt(args[5]),
		WeightZone:         toInt(args[6]),
		WeightTime:         toInt(args[7]),
		Alpha:              toInt(args[8]),
		Beta:               toInt(args[9]),
	}

	weightsJSON, err := json.Marshal(criteriaWeights)
	if err != nil {
		return shim.Error("Failed to marshal CriteriaWeights to JSON")
	}

	err = stub.PutState(key, weightsJSON)
	if err != nil {
		return shim.Error("Failed to store CriteriaWeights")
	}

	fmt.Printf("CriteriaWeights for ID %s added successfully\n", criteriaWeightsID)
	return shim.Success(nil)
}

// addMonthPrime ajoute une instance MonthPrime au réseau
func (s *SmartContract) addMonthPrime(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 4 {
		return shim.Error("Incorrect number of arguments. Expecting 4: VehicleID, Month, Year, Prime")
	}

	vehicleID := args[0]
	month := toInt(args[1])
	year := toInt(args[2])
	prime := toInt(args[3])

	// Vérifiez si la prime mensuelle existe déjà
	key := fmt.Sprintf("monthprime_%s_%d_%d", vehicleID, month, year)
	existingPrime, err := stub.GetState(key)
	if err != nil {
		return shim.Error("Failed to check existing monthly prime")
	}

	if existingPrime != nil {
		return shim.Error("MonthPrime for this VehicleID, Month, and Year already exists")
	}

	monthPrime := MonthPrime{
		VehicleID: vehicleID,
		Month:     month,
		Year:      year,
		Prime:     prime,
	}

	primeJSON, err := json.Marshal(monthPrime)
	if err != nil {
		return shim.Error("Failed to marshal MonthPrime to JSON")
	}

	err = stub.PutState(key, primeJSON)
	if err != nil {
		return shim.Error("Failed to store MonthPrime")
	}

	fmt.Printf("MonthPrime for VehicleID %s, Month %d, Year %d added successfully\n", vehicleID, month, year)
	return shim.Success(nil)
}

func (s *SmartContract) addOwnerToVehicleData(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments. Expecting 2: VehicleID, OwnerID")
	}

	vehicleID := args[0]
	ownerID := args[1]

	// Construire la clé pour récupérer l'actif VehicleData
	vehicleKey := "vehicle_" + vehicleID

	// Récupérer les données chiffrées du véhicule
	vehicleBytes, err := stub.GetState(vehicleKey)
	if err != nil || vehicleBytes == nil {
		return shim.Error("Vehicle data not found for the given VehicleID")
	}

	// Désérialiser les données existantes
	var encryptedVehicleData EncryptedVehicleData
	err = json.Unmarshal(vehicleBytes, &encryptedVehicleData)
	if err != nil {
		return shim.Error("Failed to unmarshal EncryptedVehicleData")
	}

	// Ajouter ou mettre à jour l'OwnerID
	encryptedVehicleData.OwnerID = ownerID

	// Sérialiser les données mises à jour
	updatedVehicleBytes, err := json.Marshal(encryptedVehicleData)
	if err != nil {
		return shim.Error("Failed to marshal updated EncryptedVehicleData")
	}

	// Enregistrer les données mises à jour dans le ledger
	err = stub.PutState(vehicleKey, updatedVehicleBytes)
	if err != nil {
		return shim.Error("Failed to update EncryptedVehicleData")
	}

	fmt.Printf("OwnerID '%s' added/updated for VehicleID '%s'\n", ownerID, vehicleID)
	return shim.Success(nil)
}

func (s *SmartContract) queryVehiclesByOwner(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	// Vérification du nombre d'arguments
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1: OwnerID")
	}

	ownerID := args[0]

	// Création de la requête pour récupérer les véhicules associés au OwnerID
	vehicleQueryString := fmt.Sprintf(`{"selector":{"ownerID":"%s"}}`, ownerID)

	// Exécution de la requête
	vehicleResultsIterator, err := stub.GetQueryResult(vehicleQueryString)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to query vehicles by OwnerID: %s", err.Error()))
	}
	defer vehicleResultsIterator.Close()

	// Liste pour stocker les véhicules récupérés
	var vehicles []map[string]interface{}

	for vehicleResultsIterator.HasNext() {
		vehicleResponse, err := vehicleResultsIterator.Next()
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to iterate over vehicles: %s", err.Error()))
		}

		var vehicleData EncryptedVehicleData
		err = json.Unmarshal(vehicleResponse.Value, &vehicleData)
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to unmarshal vehicle data: %s", err.Error()))
		}

		// Ajouter les détails du véhicule à la liste
		vehicles = append(vehicles, map[string]interface{}{
			"VehicleID":      vehicleData.VehicleID,
			"VehicleDetails": vehicleData,
		})
	}

	// Sérialisation des résultats en JSON
	responseJSON, err := json.Marshal(vehicles)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to marshal response: %s", err.Error()))
	}

	// Retourner les véhicules
	return shim.Success(responseJSON)
}

func (s *SmartContract) queryOwnerDetails(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1: OwnerID")
	}

	ownerID := args[0]

	// Récupérer les véhicules appartenant au propriétaire
	vehicleQueryString := fmt.Sprintf(`{"selector":{"ownerID":"%s", "contractID":{"$exists":false}}}`, ownerID)
	vehicleResultsIterator, err := stub.GetQueryResult(vehicleQueryString)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to query vehicles by OwnerID: %s", err.Error()))
	}
	defer vehicleResultsIterator.Close()

	var vehicles []map[string]interface{}
	vehicleSet := make(map[string]bool) // Pour éviter les doublons de véhicules
	var vehicleIDs []string

	for vehicleResultsIterator.HasNext() {
		vehicleResponse, err := vehicleResultsIterator.Next()
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to iterate over vehicles: %s", err.Error()))
		}

		var vehicleData EncryptedVehicleData
		err = json.Unmarshal(vehicleResponse.Value, &vehicleData)
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to unmarshal vehicle data: %s", err.Error()))
		}

		if vehicleData.VehicleID == "" || vehicleData.OwnerID != ownerID {
			continue
		}

		// Ajouter seulement si le véhicule n'est pas déjà traité
		if vehicleSet[vehicleData.VehicleID] {
			continue
		}
		vehicleSet[vehicleData.VehicleID] = true
		vehicleIDs = append(vehicleIDs, vehicleData.VehicleID)

		// Récupérer les contrats liés au véhicule
		contractQueryString := fmt.Sprintf(`{"selector":{"ownerID":"%s","vehicleID":"%s"}}`, ownerID, vehicleData.VehicleID)
		contractResultsIterator, err := stub.GetQueryResult(contractQueryString)
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to query contracts for vehicle %s: %s", vehicleData.VehicleID, err.Error()))
		}

		var contracts []map[string]interface{}
		for contractResultsIterator.HasNext() {
			contractResponse, err := contractResultsIterator.Next()
			if err != nil {
				return shim.Error(fmt.Sprintf("Failed to iterate over contracts for vehicle %s: %s", vehicleData.VehicleID, err.Error()))
			}

			var contractData InsuranceContract
			err = json.Unmarshal(contractResponse.Value, &contractData)
			if err != nil {
				return shim.Error(fmt.Sprintf("Failed to unmarshal contract data: %s", err.Error()))
			}
			if contractData.ContractID == "" {
				continue
			}

			// Récupérer les détails des critères de pondération (CriteriaWeights)
			var criteriaDetails map[string]interface{}
			if contractData.CriteriaWeightsID != "" {
				criteriaKey := "criteriaweights_" + contractData.CriteriaWeightsID
				criteriaBytes, err := stub.GetState(criteriaKey)
				if err == nil && criteriaBytes != nil {
					var criteria CriteriaWeights
					err = json.Unmarshal(criteriaBytes, &criteria)
					if err == nil {
						criteriaDetails = map[string]interface{}{
							"WeightTraffic":      criteria.WeightTraffic,
							"WeightSpeed":        criteria.WeightSpeed,
							"WeightAcceleration": criteria.WeightAcceleration,
							"WeightBraking":      criteria.WeightBraking,
							"WeightDistance":     criteria.WeightDistance,
							"WeightZone":         criteria.WeightZone,
							"WeightTime":         criteria.WeightTime,
							"Alpha":              criteria.Alpha,
							"Beta":               criteria.Beta,
						}
					}
				}
			}

			contracts = append(contracts, map[string]interface{}{
				"ContractID":        contractData.ContractID,
				"StartDate":         fmt.Sprintf("%02d-%04d", contractData.StartMonth, contractData.StartYear),
				"EndDate":           fmt.Sprintf("%02d-%04d", contractData.EndMonth, contractData.EndYear),
				"CriteriaWeightsID": contractData.CriteriaWeightsID,
				"CriteriaWeights":   criteriaDetails,
			})
		}
		contractResultsIterator.Close()

		vehicles = append(vehicles, map[string]interface{}{
			"VehicleID":      vehicleData.VehicleID,
			"VehicleDetails": vehicleData,
			"Contracts":      contracts,
		})
	}

	// Récupérer les primes associées aux trajets des véhicules du propriétaire
	var primes []map[string]interface{}
	primeSet := make(map[string]bool) // Pour éviter les doublons de primes

	for _, vehicleID := range vehicleIDs {
		tripQueryString := fmt.Sprintf(`{"selector":{"vehicleID":"%s"}}`, vehicleID)
		tripResultsIterator, err := stub.GetQueryResult(tripQueryString)
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to query trips for vehicle %s: %s", vehicleID, err.Error()))
		}

		for tripResultsIterator.HasNext() {
			tripResponse, err := tripResultsIterator.Next()
			if err != nil {
				return shim.Error(fmt.Sprintf("Failed to iterate over trips for vehicle %s: %s", vehicleID, err.Error()))
			}

			var tripData EncryptedTripData
			err = json.Unmarshal(tripResponse.Value, &tripData)
			if err != nil {
				return shim.Error(fmt.Sprintf("Failed to unmarshal trip data: %s", err.Error()))
			}

			if tripData.TripID == "" || tripData.VehicleID != vehicleID {
				continue
			}

			primeKey := "prime_" + tripData.TripID
			if primeSet[primeKey] {
				continue
			}

			primeBytes, err := stub.GetState(primeKey)
			if err != nil {
				return shim.Error(fmt.Sprintf("Failed to get prime for TripID %s: %s", tripData.TripID, err.Error()))
			}

			if primeBytes != nil {
				var primeData Prime
				err = json.Unmarshal(primeBytes, &primeData)
				if err != nil {
					return shim.Error(fmt.Sprintf("Failed to unmarshal prime data: %s", err.Error()))
				}

				primeSet[primeKey] = true
				primes = append(primes, map[string]interface{}{
					"Date":   primeData.Date,
					"Prime":  primeData.Prime,
					"TripID": primeData.TripID,
				})
			}
		}
		tripResultsIterator.Close()
	}

	// Construire la réponse finale
	response := map[string]interface{}{
		"Vehicles": vehicles,
		"Primes":   primes,
	}

	responseJSON, err := json.Marshal(response)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to marshal response: %s", err.Error()))
	}

	return shim.Success(responseJSON)
}

func (s *SmartContract) queryMultipleOwnerDetails(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) == 0 {
		return shim.Error("Expecting at least one OwnerID as argument")
	}

	// Liste pour stocker les détails de tous les propriétaires
	var allOwnerDetails []map[string]interface{}

	for _, ownerID := range args {
		if ownerID == "" {
			continue
		}

		// Appeler queryOwnerDetails pour chaque OwnerID
		response := s.queryOwnerDetails(stub, []string{ownerID})
		if response.Status != shim.OK {
			return shim.Error(fmt.Sprintf("Failed to query details for owner %s: %s", ownerID, response.Message))
		}

		// Ajouter les détails à la liste
		var ownerDetails map[string]interface{}
		err := json.Unmarshal(response.Payload, &ownerDetails)
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to unmarshal owner details for %s: %s", ownerID, err.Error()))
		}

		allOwnerDetails = append(allOwnerDetails, ownerDetails)
	}

	// Retourner tous les détails en une seule réponse
	allOwnerDetailsJSON, err := json.Marshal(allOwnerDetails)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to marshal all owner details: %s", err.Error()))
	}

	return shim.Success(allOwnerDetailsJSON)
}

func (s *SmartContract) queryAllCriteriaWeights(stub shim.ChaincodeStubInterface) pb.Response {
	queryString := `{"selector":{"_id":{"$regex":"^criteriaweights_"}}}`

	resultsIterator, err := stub.GetQueryResult(queryString)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to query all CriteriaWeights: %s", err.Error()))
	}
	defer resultsIterator.Close()

	var criteriaWeightsList []CriteriaWeights

	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to iterate through CriteriaWeights: %s", err.Error()))
		}

		var criteriaWeights CriteriaWeights
		err = json.Unmarshal(queryResponse.Value, &criteriaWeights)
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to unmarshal CriteriaWeights: %s", err.Error()))
		}

		criteriaWeightsList = append(criteriaWeightsList, criteriaWeights)
	}

	criteriaWeightsJSON, err := json.Marshal(criteriaWeightsList)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to marshal CriteriaWeights list: %s", err.Error()))
	}

	return shim.Success(criteriaWeightsJSON)
}

func (s *SmartContract) queryInsuranceContract(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	// Vérification du nombre d'arguments
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1: ContractID")
	}

	// Extraction de l'identifiant du contrat
	contractID := args[0]

	// Construction de la clé pour accéder au contrat
	contractKey := "contract_" + contractID

	// Récupération des données du contrat depuis le ledger
	contractBytes, err := stub.GetState(contractKey)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to retrieve InsuranceContract: %s", err.Error()))
	}
	if contractBytes == nil {
		return shim.Error("InsuranceContract not found for the given ContractID")
	}

	// Retourner les données du contrat
	return shim.Success(contractBytes)
}

func (s *SmartContract) queryInsuranceContractsByOwner(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	// Vérification du nombre d'arguments
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1: OwnerID")
	}

	// Extraction de l'OwnerID
	ownerID := args[0]

	// Création d'un sélecteur pour interroger les contrats par OwnerID
	queryString := fmt.Sprintf(`{"selector":{"ownerID":"%s"}}`, ownerID)

	// Exécution de la requête
	resultsIterator, err := stub.GetQueryResult(queryString)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to query insurance contracts by OwnerID: %s", err.Error()))
	}
	defer resultsIterator.Close()

	// Stockage des résultats
	var contracts []InsuranceContract

	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to iterate over query results: %s", err.Error()))
		}

		var contract InsuranceContract
		err = json.Unmarshal(queryResponse.Value, &contract)
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to unmarshal insurance contract: %s", err.Error()))
		}

		contracts = append(contracts, contract)
	}

	// Sérialisation des résultats en JSON
	contractsJSON, err := json.Marshal(contracts)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to marshal query results: %s", err.Error()))
	}

	// Retourner les résultats
	return shim.Success(contractsJSON)
}

func (s *SmartContract) queryCriteriaWeights(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	// Vérifiez le nombre d'arguments
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1: CriteriaWeightsID")
	}

	// Récupérer l'ID des poids des critères
	criteriaWeightsID := args[0]

	// Construire la clé pour accéder à CriteriaWeights
	key := "criteriaweights_" + criteriaWeightsID

	// Récupérer les données du ledger
	weightsBytes, err := stub.GetState(key)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to retrieve CriteriaWeights: %s", err.Error()))
	}
	if weightsBytes == nil {
		return shim.Error("CriteriaWeights not found for the given ID")
	}

	// Retourner les données des poids des critères
	return shim.Success(weightsBytes)
}

// queryDecryptor récupère une instance Decryptor à partir du réseau
func (s *SmartContract) queryDecryptor(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1: OwnerID")
	}

	key := "decryptor_" + args[0]

	decryptorBytes, err := stub.GetState(key)
	if err != nil {
		return shim.Error("Failed to get Decryptor")
	}
	if decryptorBytes == nil {
		return shim.Error("Decryptor not found")
	}

	fmt.Printf("Query result for Decryptor: %s\n", string(decryptorBytes))
	return shim.Success(decryptorBytes)
}

// queryVerifier récupère une instance Verifier à partir du réseau
func (s *SmartContract) queryVerifier(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1: OwnerID")
	}

	key := "verifier_" + args[0]

	verifierBytes, err := stub.GetState(key)
	if err != nil {
		return shim.Error("Failed to get Verifier")
	}
	if verifierBytes == nil {
		return shim.Error("Verifier not found")
	}

	fmt.Printf("Query result for Verifier: %s\n", string(verifierBytes))
	return shim.Success(verifierBytes)
}

// queryVehicleData récupère les données d'un véhicule à partir du réseau
func (s *SmartContract) queryVehicleData(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1: VehicleID")
	}

	// Construire la clé pour l'actif VehicleData
	key := "vehicle_" + args[0]

	// Récupérer les données à partir du ledger
	vehicleBytes, err := stub.GetState(key)
	if err != nil {
		return shim.Error("Failed to get VehicleData")
	}
	if vehicleBytes == nil {
		return shim.Error("VehicleData not found")
	}

	fmt.Printf("Query result for VehicleData: %s\n", string(vehicleBytes))
	return shim.Success(vehicleBytes)
}

func (s *SmartContract) queryTripData(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	// Vérifiez le nombre d'arguments
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1: TripID")
	}

	// Récupérer l'identifiant du trajet
	tripID := args[0]

	// Construire la clé pour accéder aux données du trajet
	tripKey := "trip_" + tripID

	// Récupérer les données du trajet à partir du ledger
	tripBytes, err := stub.GetState(tripKey)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to retrieve TripData: %s", err.Error()))
	}
	if tripBytes == nil {
		return shim.Error("TripData not found for the given TripID")
	}

	// Retourner les données du trajet
	return shim.Success(tripBytes)
}

func (s *SmartContract) queryTripsByVehicleID(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	// Vérification du nombre d'arguments
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1: VehicleID")
	}

	// Extraction de l'identifiant du véhicule
	vehicleID := args[0]

	// Création d'une requête de sélection pour les trips associés au VehicleID
	queryString := fmt.Sprintf(`{"selector":{"vehicleID":"%s"}}`, vehicleID)

	// Exécution de la requête
	resultsIterator, err := stub.GetQueryResult(queryString)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to query trips by VehicleID: %s", err.Error()))
	}
	defer resultsIterator.Close()

	// Liste pour stocker les résultats
	var trips []EncryptedTripData

	// Parcourir les résultats
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to iterate over trips: %s", err.Error()))
		}

		// Désérialiser les données de chaque trip
		var tripData EncryptedTripData
		err = json.Unmarshal(queryResponse.Value, &tripData)
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to unmarshal trip data: %s", err.Error()))
		}
		if tripData.TripID == "" {
			continue
		}
		// Ajouter le trip à la liste
		trips = append(trips, tripData)
	}

	// Sérialiser la liste des trips en JSON
	tripsJSON, err := json.Marshal(trips)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to marshal trips list: %s", err.Error()))
	}

	// Retourner les trips en tant que réponse
	return shim.Success(tripsJSON)
}

func (s *SmartContract) queryPrimesByVehicleID(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1: VehicleID")
	}

	vehicleID := args[0]
	queryString := fmt.Sprintf(`{"selector":{"vehicleID":"%s"}}`, vehicleID)

	resultsIterator, err := stub.GetQueryResult(queryString)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to query trips by VehicleID: %s", err.Error()))
	}
	defer resultsIterator.Close()

	var primes []Prime
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to iterate over trips: %s", err.Error()))
		}

		var trip EncryptedTripData
		err = json.Unmarshal(queryResponse.Value, &trip)
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to unmarshal trip data: %s", err.Error()))
		}

		primeKey := "prime_" + trip.TripID
		primeBytes, err := stub.GetState(primeKey)
		if err != nil || primeBytes == nil {
			continue
		}

		var prime Prime
		err = json.Unmarshal(primeBytes, &prime)
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to unmarshal prime data: %s", err.Error()))
		}

		primes = append(primes, prime)
	}

	primesJSON, err := json.Marshal(primes)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to marshal primes: %s", err.Error()))
	}

	return shim.Success(primesJSON)
}

func (s *SmartContract) queryEncryptedCalculationResultsByVehicleID(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1: VehicleID")
	}

	vehicleID := args[0]
	queryString := fmt.Sprintf(`{"selector":{"vehicleID":"%s"}}`, vehicleID)

	resultsIterator, err := stub.GetQueryResult(queryString)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to query trips by VehicleID: %s", err.Error()))
	}
	defer resultsIterator.Close()

	var results []EncryptedCalculationResult
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to iterate over trips: %s", err.Error()))
		}

		var trip EncryptedTripData
		err = json.Unmarshal(queryResponse.Value, &trip)
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to unmarshal trip data: %s", err.Error()))
		}

		resultKey := "result_" + trip.TripID
		resultBytes, err := stub.GetState(resultKey)
		if err != nil || resultBytes == nil {
			continue
		}

		var result EncryptedCalculationResult
		err = json.Unmarshal(resultBytes, &result)
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to unmarshal encrypted calculation result: %s", err.Error()))
		}

		results = append(results, result)
	}

	resultsJSON, err := json.Marshal(results)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to marshal encrypted calculation results: %s", err.Error()))
	}

	return shim.Success(resultsJSON)
}

func (s *SmartContract) queryEncryptedCalculationResult(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1: ResultID")
	}

	// Construire la clé pour l'actif EncryptedCalculationResult
	key := args[0] // ResultID directement passé comme clé

	// Récupérer les données à partir du ledger
	resultBytes, err := stub.GetState(key)
	if err != nil {
		return shim.Error("Failed to get EncryptedCalculationResult")
	}
	if resultBytes == nil {
		return shim.Error("EncryptedCalculationResult not found")
	}

	fmt.Printf("Query result for EncryptedCalculationResult: %s\n", string(resultBytes))
	return shim.Success(resultBytes)
}

func (s *SmartContract) queryPrime(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	// Vérification du nombre d'arguments
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1: TripID")
	}

	// Récupérer l'identifiant du trajet
	tripID := args[0]

	// Générer la clé de l'asset à partir du TripID
	primeKey := "prime_" + tripID

	// Récupérer les données de la prime depuis le ledger
	primeBytes, err := stub.GetState(primeKey)
	if err != nil || primeBytes == nil {
		return shim.Error("Prime not found for the given TripID")
	}

	// Désérialiser les données de la prime
	var prime Prime
	err = json.Unmarshal(primeBytes, &prime)
	if err != nil {
		return shim.Error("Failed to unmarshal prime data")
	}

	// Sérialiser la réponse en JSON pour l'utilisateur
	primeJSON, err := json.Marshal(prime)
	if err != nil {
		return shim.Error("Failed to marshal prime data")
	}

	return shim.Success(primeJSON)
}

func (s *SmartContract) queryMonthPrime(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	// Vérifiez le nombre d'arguments
	if len(args) != 3 {
		return shim.Error("Incorrect number of arguments. Expecting 3: VehicleID, Month, Year")
	}

	// Parse des arguments
	vehicleID := args[0]
	month, err := strconv.Atoi(args[1])
	if err != nil || month < 1 || month > 12 {
		return shim.Error("Invalid month value. Expecting a number between 1 and 12")
	}
	year, err := strconv.Atoi(args[2])
	if err != nil {
		return shim.Error("Invalid year value. Expecting a valid year")
	}

	// Construire la clé pour accéder à la prime mensuelle
	monthPrimeKey := fmt.Sprintf("monthprime_%s_%d_%d", vehicleID, month, year)

	// Récupérer les données de la prime mensuelle à partir du ledger
	monthPrimeBytes, err := stub.GetState(monthPrimeKey)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to retrieve MonthPrime: %s", err.Error()))
	}
	if monthPrimeBytes == nil {
		return shim.Error("MonthPrime not found for the given VehicleID, Month, and Year")
	}

	// Retourner les données de la prime mensuelle
	return shim.Success(monthPrimeBytes)
}

// queryVerifier récupère une instance Verifier à partir du réseau
func (s *SmartContract) TestEncryption(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 9 {
		return shim.Error("Incorrect number of arguments. Expecting 9: OwnerID, Message1, Message2, ... , Scalar")
	}

	ownerID := args[0]
	message1 := args[1]
	message2 := args[2]
	message3 := args[3]
	message4 := args[4]
	message5 := args[5]
	message6 := args[6]
	message7 := args[7]
	scalar := args[8]

	// Charger l'instance Verifier associée à OwnerID
	verifierKey := "verifier_" + ownerID
	verifierBytes, err := stub.GetState(verifierKey)
	if err != nil || verifierBytes == nil {
		return shim.Error("Verifier not found for the given OwnerID")
	}

	var verifier Verifier
	err = json.Unmarshal(verifierBytes, &verifier)
	if err != nil {
		return shim.Error("Failed to unmarshal Verifier")
	}

	n := new(big.Int)
	n.SetString(verifier.N, 10)

	// Charger l'instance Decryptor associée à OwnerID
	decryptorKey := "decryptor_" + ownerID
	decryptorBytes, err := stub.GetState(decryptorKey)
	if err != nil || decryptorBytes == nil {
		return shim.Error("Decryptor not found for the given OwnerID")
	}

	var decryptor Decryptor
	err = json.Unmarshal(decryptorBytes, &decryptor)
	if err != nil {
		return shim.Error("Failed to unmarshal Decryptor")
	}

	// Convertir les messages et le scalaire en entiers
	m1 := new(big.Int)
	m1.SetString(message1, 10)
	m2 := new(big.Int)
	m2.SetString(message2, 10)
	alpha := new(big.Int)
	alpha.SetString(scalar, 10)
	m3 := new(big.Int)
	m3.SetString(message3, 10)
	m4 := new(big.Int)
	m4.SetString(message4, 10)
	m5 := new(big.Int)
	m5.SetString(message5, 10)
	m6 := new(big.Int)
	m6.SetString(message6, 10)
	m7 := new(big.Int)
	m7.SetString(message7, 10)
	tripID := "trip5"
	vehicleID := "veh5"
	date := "2024-11-11"

	// Chiffrer les deux messages

	// uniqueData := ownerID + message1 + message2

	// r := generateDeterministicR(uniqueData, n)
	r := big.NewInt(1234)

	c2, err := verifier.EncryptWithCustomRandom(m2, r)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to encrypt m2: %s", err))
	}

	c3, err := verifier.EncryptWithCustomRandom(m3, r)
	if err != nil {
		return shim.Error("Failed to encrypt message2")
	}

	c4, err := verifier.EncryptWithCustomRandom(m4, r)
	if err != nil {
		return shim.Error("Failed to encrypt message2")
	}

	c5, err := verifier.EncryptWithCustomRandom(m5, r)
	if err != nil {
		return shim.Error("Failed to encrypt message2")
	}

	c6, err := verifier.EncryptWithCustomRandom(m6, r)
	if err != nil {
		return shim.Error("Failed to encrypt message2")
	}

	c7, err := verifier.EncryptWithCustomRandom(m7, r)
	if err != nil {
		return shim.Error("Failed to encrypt message2")
	}

	encryptedVehicleData := EncryptedVehicleData{
		VehicleID:       ownerID,
		VehicleType:     c2,
		PurchaseMileage: c3,
		Year:            c4,
	}

	encryptedTripData := EncryptedTripData{
		VehicleID:               vehicleID,
		TripID:                  tripID,
		Date:                    date,
		Speeding:                c3,
		HardAccelerations:       c4,
		EmergencyBrakes:         c5,
		UnsafeDistance:          c6,
		HighRiskZones:           c7,
		TrafficSignalCompliance: c6,
		NightDriving:            c5,
		Mileage:                 c4,
	}

	cKilometrage := encryptedTripData.Mileage

	cTrafficSignalCompliance, err := verifier.HomomorphicMultiplication(encryptedTripData.TrafficSignalCompliance, alpha)
	if err != nil {
		return shim.Error("Failed to multiply traffic signal compliance")
	}
	cSpeeding, err := verifier.HomomorphicMultiplication(encryptedTripData.Speeding, alpha)
	if err != nil {
		return shim.Error("Failed to multiply speeding")
	}
	cHardAccelerations, err := verifier.HomomorphicMultiplication(encryptedTripData.HardAccelerations, alpha)
	if err != nil {
		return shim.Error("Failed to multiply hard accelerations")
	}
	cEmergencyBrakes, err := verifier.HomomorphicMultiplication(encryptedTripData.EmergencyBrakes, alpha)
	if err != nil {
		return shim.Error("Failed to multiply emergency brakes")
	}
	cUnsafeDistance, err := verifier.HomomorphicMultiplication(encryptedTripData.UnsafeDistance, alpha)
	if err != nil {
		return shim.Error("Failed to multiply unsafe distance")
	}
	cHighRiskZones, err := verifier.HomomorphicMultiplication(encryptedTripData.HighRiskZones, alpha)
	if err != nil {
		return shim.Error("Failed to multiply high-risk zones")
	}
	cNightDriving, err := verifier.HomomorphicMultiplication(encryptedTripData.NightDriving, alpha)
	if err != nil {
		return shim.Error("Failed to multiply night driving")
	}

	cIndiceComportement, err := verifier.HomomorphicSum([]*big.Int{
		cSpeeding,
		cHardAccelerations,
		cEmergencyBrakes,
		cUnsafeDistance,
		cHighRiskZones,
		cNightDriving,
	})
	if err != nil {
		return shim.Error("Failed to calculate behavioral index")
	}

	cIndiceComportement, err = verifier.HomomorphicSubtraction(cIndiceComportement, cTrafficSignalCompliance)
	if err != nil {
		return shim.Error("Failed to perform homomorphic subtraction for compliance")
	}

	cPrimePAYD, err := verifier.HomomorphicMultiplication(cKilometrage, alpha)
	if err != nil {
		return shim.Error("Failed to calculate PAYD premium")
	}
	cPrimePHYD, err := verifier.HomomorphicMultiplication(cIndiceComportement, alpha)
	if err != nil {
		return shim.Error("Failed to calculate PHYD premium")
	}

	// Calcul de la prime totale
	cPrimeTotale, err := verifier.HomomorphicSum([]*big.Int{
		encryptedVehicleData.VehicleType,
		encryptedVehicleData.PurchaseMileage,
		encryptedVehicleData.Year,
		cPrimePAYD,
		cPrimePHYD,
	})
	if err != nil {
		return shim.Error("Failed to calculate total premium")
	}

	// Calcul de R pour le décryptage
	R := verifier.ComputeR(cPrimeTotale)

	// Générer un ResultID basé sur le TripID (ou autre stratégie unique)
	resultID := "result_" + tripID

	// Retourner les résultats chiffrés
	encryptedResult := EncryptedCalculationResult{
		ResultID:    resultID,
		PrimeTotale: cPrimeTotale,
		R:           R,
		TripID:      tripID,
	}

	rPrime, err := decryptor.ComputeRPrime(encryptedResult.R)
	if err != nil {
		return shim.Error("error compute r prime")
	}

	// Déchiffrer la prime totale
	decryptedPrime, err := verifier.VerifyAndDecrypt(encryptedResult.PrimeTotale, rPrime)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to decrypt prime: %s", err.Error()))
	}

	result := map[string]string{
		"prime value": decryptedPrime.String(),
		"rPrime":      rPrime.String(),
		"r":           encryptedResult.R.String(),
	}

	resultJSON, err := json.Marshal(result)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to marshal combined result: %s", err))
	}

	return shim.Success(resultJSON)
}

func (s *SmartContract) TestCalculateAndDecryptInsurancePremium(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 3 {
		return shim.Error("Incorrect number of arguments. Expecting 3: VehicleID, TripID, CriteriaWeightsID")
	}

	// Étape 1: Calcul de la prime d'assurance (CalculateInsurancePremium)
	calculateResponse := s.CalculateInsurancePremium(stub, args)
	if calculateResponse.Status != shim.OK {
		return shim.Error(fmt.Sprintf("CalculateInsurancePremium failed: %s", calculateResponse.Message))
	}

	// Parse the result from CalculateInsurancePremium to extract ResultID
	var encryptedResult EncryptedCalculationResult
	err := json.Unmarshal(calculateResponse.Payload, &encryptedResult)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to parse result from CalculateInsurancePremium: %s", err))
	}

	// Étape 2: Décryptage de la prime et mise à jour des données (decryptInsurancePremiumAndUpdateWithoutParams)
	decryptResponse := s.decryptInsurancePremiumAndUpdateWithoutParams(stub, []string{encryptedResult.ResultID})
	if decryptResponse.Status != shim.OK {
		return shim.Error(fmt.Sprintf("decryptInsurancePremiumAndUpdateWithoutParams failed: %s", decryptResponse.Message))
	}

	// Retourner le résultat combiné des deux étapes
	result := map[string]string{
		"CalculateInsurancePremium": string(calculateResponse.Payload),
		"DecryptInsurancePremium":   string(decryptResponse.Payload),
	}

	resultJSON, err := json.Marshal(result)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to marshal combined result: %s", err))
	}

	return shim.Success(resultJSON)
}

func (s *SmartContract) CalculateInsurancePremium(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 3 {
		return shim.Error("Incorrect number of arguments. Expecting 3: VehicleID, TripID, CriteriaWeightsID")
	}

	vehicleID := args[0]
	tripID := args[1]
	criteriaWeightsID := args[2]

	// Charger les poids des critères à partir de l'ID
	weightsKey := "criteriaweights_" + criteriaWeightsID
	weightsBytes, err := stub.GetState(weightsKey)
	if err != nil || weightsBytes == nil {
		return shim.Error("Criteria weights not found for the given CriteriaWeightsID")
	}

	var weights CriteriaWeights
	err = json.Unmarshal(weightsBytes, &weights)
	if err != nil {
		return shim.Error("Failed to unmarshal criteria weights")
	}

	// Charger les données chiffrées du véhicule
	vehicleKey := "vehicle_" + vehicleID
	vehicleBytes, err := stub.GetState(vehicleKey)
	if err != nil || vehicleBytes == nil {
		return shim.Error("Vehicle data not found for the given VehicleID")
	}

	var encryptedVehicleData EncryptedVehicleData
	err = json.Unmarshal(vehicleBytes, &encryptedVehicleData)
	if err != nil {
		return shim.Error("Failed to unmarshal encrypted vehicle data")
	}

	// Récupérer l'OwnerID depuis les données du véhicule
	ownerID := encryptedVehicleData.OwnerID

	// Charger l'instance Verifier associée au OwnerID
	verifierKey := "verifier_" + ownerID
	verifierBytes, err := stub.GetState(verifierKey)
	if err != nil || verifierBytes == nil {
		return shim.Error("Verifier not found for the given OwnerID")
	}

	var verifier Verifier
	err = json.Unmarshal(verifierBytes, &verifier)
	if err != nil {
		return shim.Error("Failed to unmarshal Verifier")
	}

	// Charger les données chiffrées du trajet
	tripKey := "trip_" + tripID
	tripBytes, err := stub.GetState(tripKey)
	if err != nil || tripBytes == nil {
		return shim.Error("Trip data not found for the given TripID")
	}

	var encryptedTripData EncryptedTripData
	err = json.Unmarshal(tripBytes, &encryptedTripData)
	if err != nil {
		return shim.Error("Failed to unmarshal encrypted trip data")
	}

	// Calcul homomorphique des primes PAYD et PHYD
	cKilometrage := encryptedTripData.Mileage

	cTrafficSignalCompliance, err := verifier.HomomorphicMultiplication(encryptedTripData.TrafficSignalCompliance, big.NewInt(int64(weights.WeightTraffic)))
	if err != nil {
		return shim.Error("Failed to multiply traffic signal compliance")
	}
	cSpeeding, err := verifier.HomomorphicMultiplication(encryptedTripData.Speeding, big.NewInt(int64(weights.WeightSpeed)))
	if err != nil {
		return shim.Error("Failed to multiply speeding")
	}
	cHardAccelerations, err := verifier.HomomorphicMultiplication(encryptedTripData.HardAccelerations, big.NewInt(int64(weights.WeightAcceleration)))
	if err != nil {
		return shim.Error("Failed to multiply hard accelerations")
	}
	cEmergencyBrakes, err := verifier.HomomorphicMultiplication(encryptedTripData.EmergencyBrakes, big.NewInt(int64(weights.WeightBraking)))
	if err != nil {
		return shim.Error("Failed to multiply emergency brakes")
	}
	cUnsafeDistance, err := verifier.HomomorphicMultiplication(encryptedTripData.UnsafeDistance, big.NewInt(int64(weights.WeightDistance)))
	if err != nil {
		return shim.Error("Failed to multiply unsafe distance")
	}
	cHighRiskZones, err := verifier.HomomorphicMultiplication(encryptedTripData.HighRiskZones, big.NewInt(int64(weights.WeightZone)))
	if err != nil {
		return shim.Error("Failed to multiply high-risk zones")
	}
	cNightDriving, err := verifier.HomomorphicMultiplication(encryptedTripData.NightDriving, big.NewInt(int64(weights.WeightTime)))
	if err != nil {
		return shim.Error("Failed to multiply night driving")
	}

	cIndiceComportement, err := verifier.HomomorphicSum([]*big.Int{
		cSpeeding,
		cHardAccelerations,
		cEmergencyBrakes,
		cUnsafeDistance,
		cHighRiskZones,
		cNightDriving,
	})
	if err != nil {
		return shim.Error("Failed to calculate behavioral index")
	}

	cIndiceComportement, err = verifier.HomomorphicSubtraction(cIndiceComportement, cTrafficSignalCompliance)
	if err != nil {
		return shim.Error("Failed to perform homomorphic subtraction for compliance")
	}

	cPrimePAYD, err := verifier.HomomorphicMultiplication(cKilometrage, big.NewInt(int64(weights.Alpha)))
	if err != nil {
		return shim.Error("Failed to calculate PAYD premium")
	}
	cPrimePHYD, err := verifier.HomomorphicMultiplication(cIndiceComportement, big.NewInt(int64(weights.Beta)))
	if err != nil {
		return shim.Error("Failed to calculate PHYD premium")
	}

	// Calcul de la prime totale
	cPrimeTotale, err := verifier.HomomorphicSum([]*big.Int{
		encryptedVehicleData.VehicleType,
		encryptedVehicleData.PurchaseMileage,
		encryptedVehicleData.Year,
		cPrimePAYD,
		cPrimePHYD,
	})
	if err != nil {
		return shim.Error("Failed to calculate total premium")
	}

	// Calcul de R pour le décryptage
	r := verifier.ComputeR(cPrimeTotale)

	// Générer un ResultID basé sur le TripID (ou autre stratégie unique)
	resultID := "result_" + tripID

	// Retourner les résultats chiffrés
	encryptedResult := EncryptedCalculationResult{
		ResultID:    resultID,
		PrimeTotale: cPrimeTotale,
		R:           r,
		TripID:      tripID,
	}

	encryptedResultJSON, err := json.Marshal(encryptedResult)
	if err != nil {
		return shim.Error("Failed to marshal encrypted calculation result")
	}

	// Enregistrer l'EncryptedCalculationResult dans le ledger
	err = stub.PutState(resultID, encryptedResultJSON)
	if err != nil {
		return shim.Error("Failed to store EncryptedCalculationResult")
	}

	return shim.Success(encryptedResultJSON)
}

func (d *Decryptor) ComputeRPrime(R *big.Int) (*big.Int, error) {
	lambda := new(big.Int)
	lambda.SetString(d.Lambda, 10)
	n := new(big.Int)
	n.SetString(d.N, 10)

	nInverseModLambda := new(big.Int).ModInverse(n, lambda)
	if nInverseModLambda == nil {
		return nil, errors.New("Failed to compute modular inverse")
	}

	fmt.Printf("R: %s\n", R.String())
	fmt.Printf("Lambda: %s\n", lambda.String())
	fmt.Printf("N: %s\n", n.String())
	fmt.Printf("N^-1 mod Lambda: %s\n", nInverseModLambda.String())

	rPrime := new(big.Int).Exp(R, nInverseModLambda, n)
	fmt.Printf("rPrime: %s\n", rPrime.String())

	return rPrime, nil
}

func (v *Verifier) VerifyAndDecrypt(C, rPrime *big.Int) (*big.Int, error) {
	// Convertir N et N^2 en big.Int
	n := new(big.Int)
	n.SetString(v.N, 10)
	nsquare := new(big.Int).Mul(n, n)

	// Étape 1 : Calculer rPrime^N mod N
	rPrimePowerN := new(big.Int).Exp(rPrime, n, n)
	fmt.Printf("rPrime: %s\n", rPrime.String())
	fmt.Printf("N: %s\n", n.String())
	fmt.Printf("C mod N: %s\n", new(big.Int).Mod(C, n).String())
	fmt.Printf("rPrime^N mod N: %s\n", rPrimePowerN.String())

	if rPrimePowerN.Cmp(new(big.Int).Mod(C, n)) != 0 {
		return nil, errors.New("Verification failed: rPrime is invalid")
	}

	// Étape 2 : Déchiffrement
	S := new(big.Int).Exp(rPrime, n, nsquare)
	SInverse := new(big.Int).ModInverse(S, nsquare)
	if SInverse == nil {
		return nil, errors.New("Failed to compute modular inverse of S")
	}

	CtimesSInverse := new(big.Int).Mul(C, SInverse)
	CtimesSInverse.Mod(CtimesSInverse, nsquare)
	CminusOne := new(big.Int).Sub(CtimesSInverse, big.NewInt(1))

	m := new(big.Int).Div(CminusOne, n)
	return m, nil
}

func (s *SmartContract) deleteVerifier(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1: OwnerID")
	}

	ownerID := args[0]

	// Construire la clé pour le Verifier
	verifierKey := "verifier_" + ownerID

	// Vérifier si le Verifier existe
	existingVerifier, err := stub.GetState(verifierKey)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to check existing Verifier: %s", err.Error()))
	}
	if existingVerifier == nil {
		return shim.Error("Verifier not found for the given OwnerID")
	}

	// Supprimer le Verifier
	err = stub.DelState(verifierKey)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to delete Verifier: %s", err.Error()))
	}

	fmt.Printf("Verifier for OwnerID %s deleted successfully\n", ownerID)
	return shim.Success(nil)
}

func (s *SmartContract) decryptInsurancePremiumAndUpdate(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments. Expecting 2: TripID, r_prime")
	}

	resultID := "result_" + args[0]

	// Convertir r_prime en *big.Int
	rPrime := new(big.Int)
	if _, ok := rPrime.SetString(args[1], 10); !ok {
		return shim.Error("Failed to parse r_prime into *big.Int")
	}

	// Récupérer l'EncryptedCalculationResult à partir du ResultID
	resultBytes, err := stub.GetState(resultID)
	if err != nil || resultBytes == nil {
		return shim.Error("EncryptedCalculationResult not found for the given ResultID")
	}

	var encryptedResult EncryptedCalculationResult
	err = json.Unmarshal(resultBytes, &encryptedResult)
	if err != nil {
		return shim.Error("Failed to unmarshal EncryptedCalculationResult")
	}

	// Charger les données associées au TripID
	tripKey := "trip_" + encryptedResult.TripID
	tripBytes, err := stub.GetState(tripKey)
	if err != nil || tripBytes == nil {
		return shim.Error("Trip data not found for the given TripID")
	}

	var encryptedTripData EncryptedTripData
	err = json.Unmarshal(tripBytes, &encryptedTripData)
	if err != nil {
		return shim.Error("Failed to unmarshal EncryptedTripData")
	}

	// Charger les données associées au véhicule
	vehicleKey := "vehicle_" + encryptedTripData.VehicleID
	vehicleBytes, err := stub.GetState(vehicleKey)
	if err != nil || vehicleBytes == nil {
		return shim.Error("Vehicle data not found for the given VehicleID")
	}

	var encryptedVehicleData EncryptedVehicleData
	err = json.Unmarshal(vehicleBytes, &encryptedVehicleData)
	if err != nil {
		return shim.Error("Failed to unmarshal EncryptedVehicleData")
	}

	ownerID := encryptedVehicleData.OwnerID

	// Charger l'instance Verifier associée au OwnerID
	verifierKey := "verifier_" + ownerID
	verifierBytes, err := stub.GetState(verifierKey)
	if err != nil || verifierBytes == nil {
		return shim.Error("Verifier not found for the given OwnerID")
	}

	var verifier Verifier
	err = json.Unmarshal(verifierBytes, &verifier)
	if err != nil {
		return shim.Error("Failed to unmarshal Verifier")
	}

	// Déchiffrer la prime totale
	decryptedPrime, err := verifier.VerifyAndDecrypt(encryptedResult.PrimeTotale, rPrime)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to decrypt prime: %s", err.Error()))
	}

	fmt.Printf("Decrypted Insurance Premium: %s\n", decryptedPrime.String())

	// Ajouter la prime déchiffrée dans un nouvel asset Prime
	primeValue := new(big.Int).Set(decryptedPrime).Int64()
	prime := Prime{
		TripID: encryptedResult.TripID,
		Date:   encryptedTripData.Date,
		Prime:  int(primeValue),
	}

	primeKey := "prime_" + encryptedResult.TripID
	primeBytes, err := json.Marshal(prime)
	if err != nil {
		return shim.Error("Failed to marshal Prime")
	}

	err = stub.PutState(primeKey, primeBytes)
	if err != nil {
		return shim.Error("Failed to store Prime")
	}

	// Mettre à jour la prime mensuelle (MonthPrime) pour le véhicule
	year, month, err := extractYearAndMonth(encryptedTripData.Date)
	if err != nil {
		return shim.Error(fmt.Sprintf("Invalid date format: %s", err.Error()))
	}

	monthPrimeKey := fmt.Sprintf("monthprime_%s_%d_%d", encryptedTripData.VehicleID, year, month)
	monthPrimeBytes, err := stub.GetState(monthPrimeKey)
	var monthPrime MonthPrime

	if monthPrimeBytes == nil {
		// Créer une nouvelle prime mensuelle si elle n'existe pas
		monthPrime = MonthPrime{
			VehicleID: encryptedTripData.VehicleID,
			Month:     month,
			Year:      year,
			Prime:     int(primeValue),
		}
	} else {
		// Charger et mettre à jour la prime existante
		err = json.Unmarshal(monthPrimeBytes, &monthPrime)
		if err != nil {
			return shim.Error("Failed to unmarshal MonthPrime")
		}
		monthPrime.Prime += int(primeValue)
	}

	// Enregistrer les données mises à jour
	updatedMonthPrimeBytes, err := json.Marshal(monthPrime)
	if err != nil {
		return shim.Error("Failed to marshal updated MonthPrime")
	}

	err = stub.PutState(monthPrimeKey, updatedMonthPrimeBytes)
	if err != nil {
		return shim.Error("Failed to store updated MonthPrime")
	}

	fmt.Printf("Updated MonthPrime: %+v\n", monthPrime)
	//return shim.Success([]byte(fmt.Sprintf("Decrypted prime: %d, updated month prime: %d", primeValue, monthPrime.Prime)))
	primeResult := map[string]interface{}{
		"decryptedPrime": primeValue,
	}
	primeResultBytes, _ := json.Marshal(primeResult)
	return shim.Success(primeResultBytes)
}

func (s *SmartContract) decryptInsurancePremiumAndUpdateWithoutParams(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1: ResultID ")
	}

	resultID := args[0]

	// Récupérer l'EncryptedCalculationResult à partir du ResultID
	resultBytes, err := stub.GetState(resultID)
	if err != nil || resultBytes == nil {
		return shim.Error("EncryptedCalculationResult not found for the given ResultID")
	}

	var encryptedResult EncryptedCalculationResult
	err = json.Unmarshal(resultBytes, &encryptedResult)
	if err != nil {
		return shim.Error("Failed to unmarshal EncryptedCalculationResult")
	}

	// Charger les données associées au TripID
	tripKey := "trip_" + encryptedResult.TripID
	tripBytes, err := stub.GetState(tripKey)
	if err != nil || tripBytes == nil {
		return shim.Error("Trip data not found for the given TripID")
	}

	var encryptedTripData EncryptedTripData
	err = json.Unmarshal(tripBytes, &encryptedTripData)
	if err != nil {
		return shim.Error("Failed to unmarshal EncryptedTripData")
	}

	// Charger les données associées au véhicule
	vehicleKey := "vehicle_" + encryptedTripData.VehicleID
	vehicleBytes, err := stub.GetState(vehicleKey)
	if err != nil || vehicleBytes == nil {
		return shim.Error("Vehicle data not found for the given VehicleID")
	}

	var encryptedVehicleData EncryptedVehicleData
	err = json.Unmarshal(vehicleBytes, &encryptedVehicleData)
	if err != nil {
		return shim.Error("Failed to unmarshal EncryptedVehicleData")
	}

	ownerID := encryptedVehicleData.OwnerID

	// Charger l'instance Verifier associée au OwnerID
	verifierKey := "verifier_" + ownerID
	verifierBytes, err := stub.GetState(verifierKey)
	if err != nil || verifierBytes == nil {
		return shim.Error("Verifier not found for the given OwnerID")
	}

	var verifier Verifier
	err = json.Unmarshal(verifierBytes, &verifier)
	if err != nil {
		return shim.Error("Failed to unmarshal Verifier")
	}

	decryptorKey := "decryptor_" + ownerID
	decryptorBytes, err := stub.GetState(decryptorKey)
	if err != nil || decryptorBytes == nil {
		return shim.Error("Verifier not found for the given OwnerID")
	}

	var decryptor Decryptor
	err = json.Unmarshal(decryptorBytes, &decryptor)
	if err != nil {
		return shim.Error("Failed to unmarshal Verifier")
	}

	rPrime, err := decryptor.ComputeRPrime(encryptedResult.R)
	if err != nil {
		return shim.Error("error compute r prime")
	}

	// Déchiffrer la prime totale
	decryptedPrime, err := verifier.VerifyAndDecrypt(encryptedResult.PrimeTotale, rPrime)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to decrypt prime: %s", err.Error()))
	}

	fmt.Printf("Decrypted Insurance Premium: %s\n", decryptedPrime.String())

	// Ajouter la prime déchiffrée dans un nouvel asset Prime
	primeValue := new(big.Int).Set(decryptedPrime).Int64()
	prime := Prime{
		TripID: encryptedResult.TripID,
		Date:   encryptedTripData.Date,
		Prime:  int(primeValue),
	}

	primeKey := "prime_" + encryptedResult.TripID
	primeBytes, err := json.Marshal(prime)
	if err != nil {
		return shim.Error("Failed to marshal Prime")
	}

	err = stub.PutState(primeKey, primeBytes)
	if err != nil {
		return shim.Error("Failed to store Prime")
	}

	// Mettre à jour la prime mensuelle (MonthPrime) pour le véhicule
	year, month, err := extractYearAndMonth(encryptedTripData.Date)
	if err != nil {
		return shim.Error(fmt.Sprintf("Invalid date format: %s", err.Error()))
	}

	monthPrimeKey := fmt.Sprintf("monthprime_%s_%d_%d", encryptedTripData.VehicleID, year, month)
	monthPrimeBytes, err := stub.GetState(monthPrimeKey)
	var monthPrime MonthPrime

	if monthPrimeBytes == nil {
		// Créer une nouvelle prime mensuelle si elle n'existe pas
		monthPrime = MonthPrime{
			VehicleID: encryptedTripData.VehicleID,
			Month:     month,
			Year:      year,
			Prime:     int(primeValue),
		}
	} else {
		// Charger et mettre à jour la prime existante
		err = json.Unmarshal(monthPrimeBytes, &monthPrime)
		if err != nil {
			return shim.Error("Failed to unmarshal MonthPrime")
		}
		monthPrime.Prime += int(primeValue)
	}

	// Enregistrer les données mises à jour
	updatedMonthPrimeBytes, err := json.Marshal(monthPrime)
	if err != nil {
		return shim.Error("Failed to marshal updated MonthPrime")
	}

	err = stub.PutState(monthPrimeKey, updatedMonthPrimeBytes)
	if err != nil {
		return shim.Error("Failed to store updated MonthPrime")
	}

	fmt.Printf("Updated MonthPrime: %+v\n", monthPrime)
	return shim.Success([]byte(fmt.Sprintf("Decrypted prime: %d, updated month prime: %d", primeValue, monthPrime.Prime)))
}

func (s *SmartContract) queryAllInsuranceContracts(stub shim.ChaincodeStubInterface) pb.Response {
	queryString := `{"selector":{"contractID":{"$exists":true}}}`

	resultsIterator, err := stub.GetQueryResult(queryString)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to query all insurance contracts: %s", err.Error()))
	}
	defer resultsIterator.Close()

	var contracts []InsuranceContract

	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to iterate through insurance contracts: %s", err.Error()))
		}

		var contract InsuranceContract
		err = json.Unmarshal(queryResponse.Value, &contract)
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to unmarshal insurance contract: %s", err.Error()))
		}

		contracts = append(contracts, contract)
	}

	contractsJSON, err := json.Marshal(contracts)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to marshal insurance contracts list: %s", err.Error()))
	}

	return shim.Success(contractsJSON)
}

func (s *SmartContract) removeAgeFromEncryptedVehicleData(stub shim.ChaincodeStubInterface) pb.Response {
	queryString := `{"selector":{"vehicleID":{"$exists":true}}}`

	resultsIterator, err := stub.GetQueryResult(queryString)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to query EncryptedVehicleData: %s", err.Error()))
	}
	defer resultsIterator.Close()

	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to iterate over EncryptedVehicleData: %s", err.Error()))
		}

		var encryptedVehicleData map[string]interface{}
		err = json.Unmarshal(queryResponse.Value, &encryptedVehicleData)
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to unmarshal EncryptedVehicleData: %s", err.Error()))
		}

		// Remove the 'age' field if it exists
		if _, exists := encryptedVehicleData["age"]; exists {
			delete(encryptedVehicleData, "age")

			updatedVehicleBytes, err := json.Marshal(encryptedVehicleData)
			if err != nil {
				return shim.Error(fmt.Sprintf("Failed to marshal updated EncryptedVehicleData: %s", err.Error()))
			}

			// Save updated record back to the ledger
			err = stub.PutState(queryResponse.Key, updatedVehicleBytes)
			if err != nil {
				return shim.Error(fmt.Sprintf("Failed to update EncryptedVehicleData: %s", err.Error()))
			}

			fmt.Printf("Removed 'age' from EncryptedVehicleData with VehicleID: %s\n", encryptedVehicleData["vehicleID"])
		}
	}

	return shim.Success([]byte("All EncryptedVehicleData assets updated successfully."))
}

func (s *SmartContract) deleteEncryptedTripData(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1: TripID")
	}

	tripID := args[0]
	tripKey := "trip_" + tripID

	// Vérifier si les données du trajet existent
	existingTrip, err := stub.GetState(tripKey)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to check existing trip data: %s", err.Error()))
	}

	if existingTrip == nil {
		return shim.Error("Trip data with this TripID does not exist")
	}

	// Supprimer les données du trajet du ledger
	err = stub.DelState(tripKey)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to delete EncryptedTripData: %s", err.Error()))
	}

	fmt.Printf("EncryptedTripData for TripID %s deleted successfully\n", tripID)
	return shim.Success(nil)
}

// extractYearAndMonth extrait l'année et le mois à partir d'une date au format YYYY-MM-DD
func extractYearAndMonth(date string) (int, int, error) {
	var year, month int
	_, err := fmt.Sscanf(date, "%d-%d", &year, &month)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to parse date: %s", date)
	}
	return year, month, nil
}

func (v *Verifier) Encrypt(m *big.Int) (*big.Int, error) {
	// Convertir N en *big.Int
	n := new(big.Int)
	n.SetString(v.N, 10)

	// Générer un aléa r dans l'intervalle [1, N-1]
	r, err := rand.Int(rand.Reader, new(big.Int).Sub(n, big.NewInt(1)))
	if err != nil {
		return nil, err
	}

	// C = (1 + mN) * r^N mod N^2
	nsquare := new(big.Int).Mul(n, n)
	rExpN := new(big.Int).Exp(r, n, nsquare)
	c := new(big.Int).Add(big.NewInt(1), new(big.Int).Mul(m, n))
	c.Mul(c, rExpN)
	c.Mod(c, nsquare)

	return c, nil
}

func (v *Verifier) EncryptWithCustomRandom(m *big.Int, r *big.Int) (*big.Int, error) {
	n := new(big.Int)
	n.SetString(v.N, 10)

	// Vérifier que r est dans l'intervalle [1, N-1]
	if r.Cmp(big.NewInt(1)) < 0 || r.Cmp(new(big.Int).Sub(n, big.NewInt(1))) >= 0 {
		return nil, errors.New("r must be in the range [1, N-1]")
	}

	// C = (1 + mN) * r^N mod N^2
	nsquare := new(big.Int).Mul(n, n)
	rExpN := new(big.Int).Exp(r, n, nsquare)
	c := new(big.Int).Add(big.NewInt(1), new(big.Int).Mul(m, n))
	c.Mul(c, rExpN)
	c.Mod(c, nsquare)

	return c, nil
}

func (v *Verifier) ComputeR(C *big.Int) *big.Int {
	// Convertir N en big.Int
	n := new(big.Int)
	n.SetString(v.N, 10)

	// Calcul de R = C mod N
	return new(big.Int).Mod(C, n)
}

func (v *Verifier) HomomorphicAddition(C1, C2 *big.Int) *big.Int {
	// N^2 = n * n
	n := new(big.Int)
	n.SetString(v.N, 10)

	nsquare := new(big.Int).Mul(n, n)

	// C1 * C2 mod N^2
	return new(big.Int).Mod(new(big.Int).Mul(C1, C2), nsquare)
}

func (v *Verifier) HomomorphicSum(ciphertexts []*big.Int) (*big.Int, error) {
	// Convertir N en big.Int
	n := new(big.Int)
	n.SetString(v.N, 10)

	// Calculer N^2
	nsquare := new(big.Int).Mul(n, n)

	// Initialiser le résultat à 1 (identité multiplicative pour l'addition homomorphe)
	result := big.NewInt(1)

	// Effectuer l'addition homomorphe : (C1 * C2 * ... * Cn) mod N^2
	for _, ciphertext := range ciphertexts {
		result.Mul(result, ciphertext)
		result.Mod(result, nsquare)
	}

	return result, nil
}

func (v *Verifier) HomomorphicSubtraction(C1, C2 *big.Int) (*big.Int, error) {
	// Convertir N en big.Int
	n := new(big.Int)
	n.SetString(v.N, 10)

	// Calculer N^2
	nsquare := new(big.Int).Mul(n, n)

	// Calculer l'inverse modulaire de C2 modulo N^2
	C2Inverse := new(big.Int).ModInverse(C2, nsquare)
	if C2Inverse == nil {
		return nil, errors.New("Failed to compute modular inverse of C2")
	}

	// Effectuer la soustraction homomorphe : (C1 * C2^(-1)) mod N^2
	result := new(big.Int).Mul(C1, C2Inverse)
	result.Mod(result, nsquare)

	return result, nil
}

func (v *Verifier) HomomorphicMultiplication(C *big.Int, alpha *big.Int) (*big.Int, error) {
	// Convertir N en big.Int
	n := new(big.Int)
	n.SetString(v.N, 10)

	// Calculer N^2
	nsquare := new(big.Int).Mul(n, n)

	// Effectuer la multiplication homomorphe : (C^alpha) mod N^2
	result := new(big.Int).Exp(C, alpha, nsquare)

	return result, nil
}

// Génère un r déterministe basé sur un hash cryptographique.
func generateDeterministicR(data string, n *big.Int) *big.Int {
	// Hacher les données
	hash := sha256.Sum256([]byte(data))

	// Convertir le hash en un grand entier
	hashInt := new(big.Int).SetBytes(hash[:])

	// Calculer r = (hash mod (n-1)) + 1 pour garantir que 1 <= r < n
	nMinusOne := new(big.Int).Sub(n, big.NewInt(1))
	r := new(big.Int).Mod(hashInt, nMinusOne)
	r.Add(r, big.NewInt(1))

	return r
}

func toInt(value string) int {
	result, _ := strconv.Atoi(value)
	return result
}

func toInt64(value string) int64 {
	result, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		panic(fmt.Sprintf("Failed to convert value %s to int64", value))
	}
	return result
}

func main() {
	err := shim.Start(new(SmartContract))
	if err != nil {
		fmt.Printf("Error starting Smart Contract: %s", err)
	}
}
