import requests as _requests
from dotenv import load_dotenv as _load_dotenv
import os as _os
import time as _time
import json as _json

class JellyfinUnavailableError(Exception):
    """Raised when Jellyfin cannot be reached or does not respond successfully."""

def _refresh_all_environment_variables():
    global JELLYFIN_API_KEY


    JELLYFIN_API_KEY = _os.getenv("JELLYFIN_API_KEY")


def ensure_jellyfin_available(timeout=2):
    baseUrl = getJellyfinUrl()
    if not baseUrl:
        raise Exception("Jellyfin URL is not configured.")

    _load_dotenv(override=True)
    _refresh_all_environment_variables()
    try:
        response = _requests.get(
            f"{baseUrl}/System/Ping",
            headers={"Authorization": f"MediaBrowser Token={JELLYFIN_API_KEY}"},
            timeout=timeout,
        )
        response.raise_for_status()
    except _requests.RequestException as error:
        raise JellyfinUnavailableError(
            "Jellyfin is unavailable or did not respond within 2 seconds."
        ) from error

def proxy_jellyfin_stream(proxy_path, query_params, request_headers):
    baseUrl = getJellyfinUrl()
    if not baseUrl:
        raise Exception("Jellyfin URL is not configured.")
    
    if not proxy_path.startswith("videos/"):
        raise ValueError("Only Jellyfin video streams are allowed.")
    if not JELLYFIN_API_KEY:
        raise ValueError("Jellyfin API key is not configured.")

    ensure_jellyfin_available()
    headers = {
        "Authorization": f"MediaBrowser Token={JELLYFIN_API_KEY}",
        "Accept": request_headers.get("Accept", "*/*"),
    }
    if request_headers.get("Range"):
        headers["Range"] = request_headers["Range"]

    return _requests.get(
        f"{baseUrl}/{proxy_path}",
        params=query_params,
        headers=headers,
        stream=True,
        timeout=(5, 60),
    )

def refresh_jellyfin_libraries():
    baseUrl = getJellyfinUrl()
    if not baseUrl:
        raise Exception("Jellyfin URL is not configured.")
        
    _load_dotenv(override=True)  # Load environment variables from .env file
    _refresh_all_environment_variables()  # Refresh the global variables with the latest values
    url = f"{baseUrl}/Library/Refresh"
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
    baseUrl = getJellyfinUrl()
    if not baseUrl:
        raise Exception("Jellyfin URL is not configured.")
        
    _load_dotenv(override=True)  # Load environment variables from .env file
    _refresh_all_environment_variables()  # Refresh the global variables with the latest values
    url = f"{baseUrl}/Users"
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
    baseUrl = getJellyfinUrl()
    if not baseUrl:
        raise Exception("Jellyfin URL is not configured.")
        
    _load_dotenv(override=True)  # Load environment variables from .env file
    _refresh_all_environment_variables()  # Refresh the global variables with the latest values
    url = f"{baseUrl}/Users/{user_id}"
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
    baseUrl = getJellyfinUrl()
    if not baseUrl:
        raise Exception("Jellyfin URL is not configured.")
    
    _load_dotenv(override=True)  # Load environment variables from .env file
    _refresh_all_environment_variables()  # Refresh the global variables with the latest values
    url = f"{baseUrl}/Users/New"
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
    baseUrl = getJellyfinUrl()
    if not baseUrl:
        raise Exception("Jellyfin URL is not configured.")

    _load_dotenv(override=True)  # Load environment variables from .env file
    _refresh_all_environment_variables()  # Refresh the global variables with the latest values
    url = f"{baseUrl}/Users?userId={user_id}"
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
            raise Exception(f"Failed to update Jellyfin user. Status code: {response.status_code}, Response: {error_message}")

def update_jellyfin_user_password(user_id, new_password_data):
    _load_dotenv(override=True)  # Load environment variables from .env file
    _refresh_all_environment_variables()  # Refresh the global variables with the latest values
    baseUrl = getJellyfinUrl()
    if not baseUrl:
        raise Exception("Jellyfin URL is not configured.")
    
    url = f"{baseUrl}/Users/{user_id}/Password"
    headers = {
        "Authorization": f"MediaBrowser Token={JELLYFIN_API_KEY}",
        "Content-Type": "application/json"
    }
    response = _requests.post(url, headers=headers, json=new_password_data)
    
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
            raise Exception(f"Failed to update Jellyfin user password. Status code: {response.status_code}, Response: {error_message}")

def delete_jellyfin_user(user_id):
    baseUrl = getJellyfinUrl()
    if not baseUrl:
        raise Exception("Jellyfin URL is not configured.")

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

def get_jellyfin_media_id(name, includeType, seriesName=None):
    baseUrl = getJellyfinUrl()
    if not baseUrl:
        raise Exception("Jellyfin URL is not configured.")
    
    ensure_jellyfin_available()
    _load_dotenv(override=True)  # Load environment variables from .env file
    _refresh_all_environment_variables()  # Refresh the global variables with the latest values

    url = f"{baseUrl}/Items?searchTerm={name}&IncludeItemTypes={includeType}&Recursive=true"
    headers = {
        "Authorization": f"MediaBrowser Token={JELLYFIN_API_KEY}",
        "Content-Type": "application/json"
    }
    response = _requests.get(url, headers=headers)
    
    if response.status_code == 200:
        items = list(filter((lambda item: item.get("SeriesName", "").lower() == seriesName.lower() if (includeType == "Episode" and seriesName) else True),response.json().get("Items", [])))
        if items:
            return items[0].get("Id")
        else:
            raise Exception(f"No media found with name: {name} {'and series name: ' + seriesName if seriesName else ''}.")
    else:
        raise Exception(f"Failed to get Jellyfin media ID. Status code: {response.status_code}, Response: {response.text}")

def check_jellyfin(url):
    _load_dotenv(override=True)  # Load environment variables from .env file
    _refresh_all_environment_variables()  # Refresh the global variables with the latest values
    url = url.rstrip('/') + "/System/Ping"  # Ensure the URL ends with /System/Ping
    headers = {
        "Accept": "application/json"
    }
    response = _requests.get(url, headers=headers)
    
    if response.status_code == 200:
        return "Ok"
    else:
        raise Exception(f"Failed to check Jellyfin. Status code: {response.status_code}, Response: {response.text or 'No response text'}")

def check_jellyfin_api_key(api_key):
    baseUrl = getJellyfinUrl()
    if not baseUrl:
        raise Exception("Jellyfin URL is not configured.")
    _load_dotenv(override=True)  # Load environment variables from .env file
    _refresh_all_environment_variables()  # Refresh the global variables with the latest values
    url = f"{baseUrl}/System/Info"
    headers = {
        "Authorization": f"MediaBrowser Token={api_key}",
        "Accept": "application/json"
    }
    response = _requests.get(url, headers=headers)
    
    if response.status_code == 200:
        return True
    else:
        return False

def getJellyfinUrl() -> str | None:
    configFile = _os.path.join(_os.path.dirname(__file__), "../../frontend/config.json")
    if not _os.path.exists(configFile):
        return None
    try:
        with open(configFile, "r") as f:
            config = f.read()
            jsonConfig = _json.loads(config).get("JELLYFIN_SECTION", {})
            installed = jsonConfig.get("JELLYFIN_INSTALLED", False)
            selection = jsonConfig.get("JELLYFIN_SELECTION", None)
            url = jsonConfig.get("JELLYFIN_URL", None)
            url_port = jsonConfig.get("JELLYFIN_URL_PORT", 8096)
            if installed == False :
                return None
            if selection == "local":
                return f"http://localhost:{url_port}"
            elif selection == "remote" and url:
                return url
    except Exception as e:
        print(f"Error reading config file: {e}")
        return None