import logo from './logo.png';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <a
          className="App-link"
          href="https://shopper.com.br"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src={logo} className="App-logo" alt="logo" />
        </a>
        <h1 className='App-title'>Shooper Price Update Tool</h1>
      </header>
      <body>
        <div className='App-form'>
          <form action="post">
            <input className= "App-form-component" type="file" name="update-price-file" id="update-file-input-id" />
            <br/>
            <button className= "App-form-component" type="submit">VALIDAR</button>
          </form>
        </div>
      </body>
    </div>
  );
}

export default App;
