package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

// AuthChaincode manages user authentication
type AuthChaincode struct {
}

// User struct to store user details
type User struct {
	Name        string `json:"name"`
	Password    string `json:"password"`
	Role        string `json:"role"`
	Dateofbirth string `json:"dateofbirth"`
	Address     string `json:"address"`
}

// Init initializes the chaincode
func (t *AuthChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response {
	fmt.Println("Chaincode initialized")
	return shim.Success(nil)
}

// Invoke routes the requests to the appropriate function
func (t *AuthChaincode) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	function, args := stub.GetFunctionAndParameters()

	if function == "register" {
		return t.register(stub, args)
	} else if function == "getRole" {
		return t.getRole(stub, args)
	} else if function == "changePassword" {
		return t.changePassword(stub, args)
	} else if function == "getClients" {
		return t.getClients(stub, args)
	} else if function == "deleteUser" {
		return t.deleteUser(stub, args)
	} else if function == "updateAgeAndAddress" {
		return t.updateDateofbirthAndAddress(stub, args)
	}

	return shim.Error("Invalid function name")
}

// register allows adding a new user
func (t *AuthChaincode) register(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 5 {
		return shim.Error("Incorrect number of arguments. Expecting 5: name, password, role, age, address")
	}

	name := args[0]
	password := args[1]
	role := args[2]
	dateofbirth := args[3]
	address := args[4]

	hashedPassword := hashPassword(hashPassword(password))

	user := User{Name: name, Password: hashedPassword, Role: role, Dateofbirth: dateofbirth, Address: address}
	userBytes, err := json.Marshal(user)
	if err != nil {
		return shim.Error("Failed to marshal user object")
	}

	err = stub.PutState(name, userBytes)
	if err != nil {
		return shim.Error("Failed to store user information")
	}

	return shim.Success([]byte("User registered successfully"))
}

// getRole retrieves the role of a user based on name and password
func (t *AuthChaincode) getRole(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments. Expecting 2: name, password")
	}

	name := args[0]
	password := args[1]

	userBytes, err := stub.GetState(name)
	if err != nil {
		return shim.Error("Failed to get user information")
	}
	if userBytes == nil {
		return shim.Error("User not found")
	}

	var user User
	err = json.Unmarshal(userBytes, &user)
	if err != nil {
		return shim.Error("Failed to unmarshal user object")
	}

	if user.Password != hashPassword(password) {
		return shim.Error("Invalid password")
	}

	return shim.Success([]byte(user.Role))
}

// changePassword updates the password for an existing user
func (t *AuthChaincode) changePassword(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 3 {
		return shim.Error("Incorrect number of arguments. Expecting 3: name, current password, new password")
	}

	name := args[0]
	currentPassword := args[1]
	newPassword := args[2]

	userBytes, err := stub.GetState(name)
	if err != nil {
		return shim.Error("Failed to get user information")
	}
	if userBytes == nil {
		return shim.Error("User not found")
	}

	var user User
	err = json.Unmarshal(userBytes, &user)
	if err != nil {
		return shim.Error("Failed to unmarshal user object")
	}

	if user.Password != hashPassword(currentPassword) {
		return shim.Error("Invalid current password")
	}

	hashedNewPassword := hashPassword(newPassword)
	user.Password = hashedNewPassword

	updatedUserBytes, err := json.Marshal(user)
	if err != nil {
		return shim.Error("Failed to marshal updated user object")
	}

	err = stub.PutState(name, updatedUserBytes)
	if err != nil {
		return shim.Error("Failed to update user information")
	}

	return shim.Success([]byte("Password updated successfully"))
}

// getClients retrieves the list of users with the role "client"
func (t *AuthChaincode) getClients(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 0 {
		return shim.Error("Incorrect number of arguments. Expecting 0")
	}

	startKey := ""
	endKey := ""

	resultsIterator, err := stub.GetStateByRange(startKey, endKey)
	if err != nil {
		return shim.Error("Failed to get users from the ledger")
	}
	defer resultsIterator.Close()

	var clients []User

	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return shim.Error("Failed to iterate through users")
		}

		var user User
		err = json.Unmarshal(queryResponse.Value, &user)
		if err != nil {
			return shim.Error("Failed to unmarshal user object")
		}

		if user.Role == "client" {
			clients = append(clients, user)
		}
	}

	clientsBytes, err := json.Marshal(clients)
	if err != nil {
		return shim.Error("Failed to marshal clients list")
	}

	return shim.Success(clientsBytes)
}

// updateAgeAndAddress updates the age and address of an existing user
func (t *AuthChaincode) updateDateofbirthAndAddress(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 3 {
		return shim.Error("Incorrect number of arguments. Expecting 3: name, dateofbirth, address")
	}

	name := args[0]
	dateofbirth := args[1]
	address := args[2]

	userBytes, err := stub.GetState(name)
	if err != nil {
		return shim.Error("Failed to get user information")
	}
	if userBytes == nil {
		return shim.Error("User not found")
	}

	var user User
	err = json.Unmarshal(userBytes, &user)
	if err != nil {
		return shim.Error("Failed to unmarshal user object")
	}

	user.Dateofbirth = dateofbirth
	user.Address = address

	updatedUserBytes, err := json.Marshal(user)
	if err != nil {
		return shim.Error("Failed to marshal updated user object")
	}

	err = stub.PutState(name, updatedUserBytes)
	if err != nil {
		return shim.Error("Failed to update user information")
	}

	return shim.Success([]byte("Age and address updated successfully"))
}

func (t *AuthChaincode) deleteUser(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expected: 1 (name)")
	}

	name := args[0]

	// Check if the user exists
	userBytes, err := stub.GetState(name)
	if err != nil {
		return shim.Error("Failed to retrieve user information")
	}
	if userBytes == nil {
		return shim.Error("User not found")
	}

	// Delete the user from the ledger
	err = stub.DelState(name)
	if err != nil {
		return shim.Error("Failed to delete user")
	}

	return shim.Success([]byte("User successfully deleted"))
}

// hashPassword hashes the password using SHA-256
func hashPassword(password string) string {
	hash := sha256.Sum256([]byte(password))
	return hex.EncodeToString(hash[:])
}

func main() {
	err := shim.Start(new(AuthChaincode))
	if err != nil {
		fmt.Printf("Error starting AuthChaincode: %s", err)
	}
}
