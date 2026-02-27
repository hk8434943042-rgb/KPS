from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/test', methods=['POST', 'GET'])
def test():
    return jsonify({'method': request.method, 'success': True})

if __name__ == '__main__':
    print("Starting minimal Flask...")
    app.run(port=5001, debug=False)
