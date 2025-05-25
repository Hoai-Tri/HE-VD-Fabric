# HE-VD-Fabric

## Project Overview
This project implements a **blockchain-based privacy-preserving insurance platform** for connected vehicles. It leverages **Hyperledger Fabric (HLF)**, **Homomorphic Encryption (HE)**, and **Verifiable Decryption (VD)** to ensure **secure and transparent** insurance premium calculations while maintaining data privacy.

## Project Structure
```
📦 Project Root
├── 📂 frontend       # Frontend (React.js)
├── 📂 backend        # Backend (Node.js)
├── 📂 hlf_network    # Hyperledger Fabric Network (Minifabric)
```

## Prerequisites
Before setting up the project, ensure the following requirements are met:

### 1. Install Docker
Minifabric requires **Docker CE 18.03 or newer**. Install Docker from [Docker's official website](https://www.docker.com/get-started).

### 2. Install Minifabric
#### Linux / macOS:
```sh
mkdir -p ~/mywork && cd ~/mywork && curl -o minifab -sL https://tinyurl.com/yxa2q6yr && chmod +x minifab
```
#### Windows:
```sh
mkdir %userprofile%\mywork & cd %userprofile%\mywork & curl -o minifab.cmd -sL https://tinyurl.com/y3gupzby
```
#### Add Minifabric to System Path
Move the `minifab` (Linux/macOS) or `minifab.cmd` (Windows) script to a directory in your system's **execution PATH** or add the containing directory to the PATH.

## Setting up the Hyperledger Fabric Network
### 1. Deploy Fabric Network
Navigate to the `hlf_network` directory and run:
```sh
cd hlf_network
minifab up -s couchdb -e true -o org1.insurance.com
```

### 2. Deploy Smart Contracts (Chaincodes)
Copy the chaincodes into the Fabric network:
```sh
cp -r chaincodes/authentification vars/chaincode/
cp -r chaincodes/securedrive vars/chaincode/
```
Deploy the `authentification` and `securedrive` chaincodes:
```sh
minifab ccup -l go -n authentification -v 1.0
minifab ccup -l go -n securedrive -v 1.0
```

### 3. Launch Fabric Explorer Dashboard
To monitor the Fabric network, launch the explorer dashboard:
```sh
minifab explorerup
```
Access the dashboard via: **http://localhost:7014**

### 4. Create the First User
Run the following command to create the first insurance user:
```sh
minifab invoke -p '"register", "car_insurance1", "1e246d76d4fa355e2531816477eb5b17ebfa29e374d2592198cd65da6092ebf5", "insurer"' -o org1.insurance.com
```

## Running the Backend and Frontend
### 1. Start the Backend
Navigate to the `backend` folder and start the server:
```sh
cd backend
npm install  # Install dependencies
npm start    # Start the backend server
```

### 2. Start the Frontend
Navigate to the `frontend` folder and launch the client:
```sh
cd frontend
npm install  # Install dependencies
npm start    # Start the frontend application
```

## Using the Application
1. Open the frontend application in your browser.
2. Login using the following credentials:
   - **Username**: `car_insurance1`
   - **Secret**: `insurerpw`
3. Once logged in, you can create **vehicle owners**, **vehicles**, **trips**, etc.

## Shutting Down the Network
Once you have finished testing, shut down the Fabric network:
```sh
minifab down
```

## Notes
- **Ensure Docker is running** before starting the Fabric network.
- If you need to reset the network, run:
  ```sh
  minifab cleanup
  ```
- Modify smart contracts as needed before deploying them.

## License
This project is licensed under the **Apache License Version 2.0, January 2004  http://www.apache.org/licenses/**.

