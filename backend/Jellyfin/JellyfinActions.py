import requests as _requests
from dotenv import load_dotenv as _load_dotenv
import os as _os
import time as _time

def _refresh_all_environment_variables():
    global JELLYFIN_API_KEY


    JELLYFIN_API_KEY = _os.getenv("JELLYFIN_API_KEY")

def refresh_jellyfin_libraries():
        _load_dotenv(override=True)  # Load environment variables from .env file
        _refresh_all_environment_variables()  # Refresh the global variables with the latest values
        url = "http://localhost:8096/Library/Refresh"
        headers = {
            "Authorization": f"MediaBrowser Token={JELLYFIN_API_KEY}",
            "Content-Type": "application/json"
        }
        while True:
            response = _requests.post(url, headers=headers, json={})
            
            if response.status_code in (200, 204):
                print("Jellyfin libraries refreshed successfully.")
                return True  # Break the loop and exit the function successfully
                
            elif response.status_code == 503:
                retry_after = int(response.headers.get('Retry-After', 5))
                message = response.json().get('message', 'Service Unavailable')
                print(f"{message}. Retrying after {retry_after} seconds...")
                _time.sleep(retry_after)
                continue  # Loop goes back to the top and tries again cleanly
                
            else:
                raise Exception(f"Failed to refresh Jellyfin libraries. Status code: {response.status_code}, Response: {response.text or 'No response text'}")

def get_jellyfin_users():
    _load_dotenv(override=True)  # Load environment variables from .env file
    _refresh_all_environment_variables()  # Refresh the global variables with the latest values
    url = "http://localhost:8096/Users"
    headers = {
        "Authorization": f"MediaBrowser Token={JELLYFIN_API_KEY}",
        "Content-Type": "application/json"
    }
    response = _requests.get(url, headers=headers)
    
    if response.status_code == 200:
        users = response.json()
        return users
    else:
        raise Exception(f"Failed to get Jellyfin users. Status code: {response.status_code}, Response: {response.text}")

def get_jellyfin_user_by_id(user_id):
    _load_dotenv(override=True)  # Load environment variables from .env file
    _refresh_all_environment_variables()  # Refresh the global variables with the latest values
    url = f"http://localhost:8096/Users/{user_id}"
    headers = {
        "Authorization": f"MediaBrowser Token={JELLYFIN_API_KEY}",
        "Content-Type": "application/json"
    }
    response = _requests.get(url, headers=headers)
    
    if response.status_code == 200:
        user = response.json()
        return user
    else:
        try:
            error_message = (
                ", ".join(
                    f"{key} : {','.join(str(v) for v in value)}"
                    for key, value in response.json().get("errors", {}).items()
                )
                if response.content
                else "No response text"
            )
        except ValueError:
            error_message = response.text or "No response text"
        raise Exception(f"Failed to add Jellyfin user. Status code: {response.status_code}, Response: {error_message}")

def add_jellyfin_user(user_data):
    _load_dotenv(override=True)  # Load environment variables from .env file
    _refresh_all_environment_variables()  # Refresh the global variables with the latest values
    url = "http://localhost:8096/Users/New"
    headers = {
        "Authorization": f"MediaBrowser Token={JELLYFIN_API_KEY}",
        "Content-Type": "application/json",
    }
    response = _requests.post(url, headers=headers, json=user_data)
    
    if response.status_code in (200, 201):
        user = response.json()
        return user
    else:
        try:
            error_message = (
                ", ".join(
                    f"{key} : {','.join(str(v) for v in value)}"
                    for key, value in response.json().get("errors", {}).items()
                )
                if response.content
                else "No response text"
            )
        except ValueError:
            error_message = response.text or "No response text"
        raise Exception(f"Failed to add Jellyfin user. Status code: {response.status_code}, Response: {error_message}")

def update_jellyfin_user(user_id, user_data):
    _load_dotenv(override=True)  # Load environment variables from .env file
    _refresh_all_environment_variables()  # Refresh the global variables with the latest values
    url = f"http://localhost:8096/Users/{user_id}"
    headers = {
        "Authorization": f"MediaBrowser Token={JELLYFIN_API_KEY}",
        "Content-Type": "application/json"
    }
    response = _requests.post(url, headers=headers, json=user_data)
    
    if response.status_code in (200, 204):
        return True
    else:
            try:
                error_message = (
                    ", ".join(
                        f"{key} : {','.join(str(v) for v in value)}"
                        for key, value in response.json().get("errors", {}).items()
                    )
                    if response.content
                    else "No response text"
                )
            except ValueError:
                error_message = response.text or "No response text"
            raise Exception(f"Failed to add Jellyfin user. Status code: {response.status_code}, Response: {error_message}")

def delete_jellyfin_user(user_id):
    _load_dotenv(override=True)  # Load environment variables from .env file
    _refresh_all_environment_variables()  # Refresh the global variables with the latest values
    url = f"http://localhost:8096/Users/{user_id}"
    headers = {
        "Authorization": f"MediaBrowser Token={JELLYFIN_API_KEY}",
        "Content-Type": "application/json"
    }
    response = _requests.delete(url, headers=headers)
    
    if response.status_code in (200, 204):
        return True
    else:
            try:
                error_message = (
                    ", ".join(
                        f"{key} : {','.join(str(v) for v in value)}"
                        for key, value in response.json().get("errors", {}).items()
                    )
                    if response.content
                    else "No response text"
                )
            except ValueError:
                error_message = response.text or "No response text"
            raise Exception(f"Failed to add Jellyfin user. Status code: {response.status_code}, Response: {error_message}")