
def success_response(data):
    return {
        "success": True,
        "data": data
    }

def error_response(message):
    return {
        "success": False,
        "message": "Item already exists with this id" if "duplicate key" in message.lower() else message
    }