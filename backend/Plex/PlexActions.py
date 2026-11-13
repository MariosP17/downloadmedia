import requests as _requests 
from dotenv import load_dotenv as _load_dotenv
import os as _os
import json as _json

def _refresh_all_environment_variables():
    global PLEX_API_KEY, PLEX_CLIENT_IDENTIFIER

    PLEX_API_KEY = _os.getenv("PLEX_API_KEY")
    PLEX_CLIENT_IDENTIFIER = _os.getenv("PLEX_CLIENT_IDENTIFIER")

def refresh_plex_libraries():
    baseUrl = get_plex_url()
    if not baseUrl:
        raise Exception("Plex URL is not configured. Please set the PLEX_URL environment variable.")
    
    _load_dotenv(override=True)  # Load environment variables from .env file
    _refresh_all_environment_variables()  # Refresh the global variables with the latest values
    url = f"{baseUrl}/library/sections/all/refresh"
    headers = {
        "X-Plex-Token": PLEX_API_KEY,
        "Content-Type": "application/json"
    }
    response = _requests.get(url, headers=headers)
    
    if response.status_code in (200, 204):
        print("Plex libraries refreshed successfully.")
        return True
    raise Exception(f"Failed to refresh Plex libraries. Status code: {response.status_code}, Response: {response.text}")

def get_plex_users():
    _load_dotenv(override=True)  # Load environment variables from .env file
    _refresh_all_environment_variables()  # Refresh the global variables with the latest values
    url = "https://plex.tv/api/v2/home/users"
    headers = {
        "X-Plex-Token": PLEX_API_KEY,
        "X-Plex-Client-Identifier": PLEX_CLIENT_IDENTIFIER,
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    response = _requests.get(url, headers=headers)
    
    if response.status_code == 200:
        users = response.json()
        return users
    else:
        errorMessagesList = response.json().get('errors', [])
        if errorMessagesList:
            errorMessages = [error.get('message', 'Unknown error') for error in errorMessagesList]
            raise Exception(f"Failed to get Plex users. Status code: {response.status_code}, Response: {'; '.join(errorMessages)}")
        raise Exception(f"Failed to get Plex users. Status code: {response.status_code}, Response: No response text")

def check_plex(url):
    _load_dotenv(override=True)  # Load environment variables from .env file
    _refresh_all_environment_variables()  # Refresh the global variables with the latest values
    url = url.rstrip('/') + "/identity"  # Ensure the URL ends with /identity
    headers = {
        "Accept": "application/json"
    }
    response = _requests.get(url, headers=headers)
    
    if response.status_code == 200:
        return "Ok"
    else:
        errorMessagesList = response.json().get('errors', [])
        if errorMessagesList:
            errorMessages = [error.get('message', 'Unknown error') for error in errorMessagesList]
            raise Exception(f"Failed to get Plex identity. Status code: {response.status_code}, Response: {'; '.join(errorMessages)}")
        raise Exception(f"Failed to get Plex identity. Status code: {response.status_code}, Response: No response text")

def check_plex_api_key(api_key):
    baseUrl = get_plex_url()
    if not baseUrl:
        raise Exception("Plex URL is not configured. Please set the PLEX_URL environment variable.")
    
    _load_dotenv(override=True)  # Load environment variables from .env file
    _refresh_all_environment_variables()  # Refresh the global variables with the latest values
    url = baseUrl.rstrip('/') + "/"  # Ensure the URL ends with /
    headers = {
        "X-Plex-Token": api_key,
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    response = _requests.get(url, headers=headers)
    
    try:
        response = _requests.get(url, headers=headers, timeout=5)
        return response.status_code == 200
    except _requests.RequestException:
        # Catch connection errors (server offline, bad IP/Port)
        return False

def get_plex_url():
    configFile = _os.path.join(_os.path.dirname(__file__), "../../frontend/config.json")
    if not _os.path.exists(configFile):
        return None
    try:
        with open(configFile, "r") as f:
            config = f.read()
            jsonConfig = _json.loads(config).get("PLEX_SECTION", {})
            installed = jsonConfig.get("PLEX_INSTALLED", False)
            selection = jsonConfig.get("PLEX_SELECTION", None)
            url = jsonConfig.get("PLEX_URL", None)
            url_port = jsonConfig.get("PLEX_URL_PORT", 32400)
            if installed == False :
                return None
            if selection == "local":
                return f"http://localhost:{url_port}"
            elif selection == "remote" and url:
                return url
    except Exception as e:
        print(f"Error reading config file: {e}")
        return None