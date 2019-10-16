// Import React and Component
import React, { Component } from "react";
import "bulma/css/bulma.css";
import "./App.css";
import FaucetRequest from "./FaucetRequest/FaucetRequest";
import config from "react-global-configuration";
import configuration from "./config";
import axios from "axios";

config.set(configuration);

class App extends Component {
  constructor() {
    super();
    this.state = {
      faucetinfo: null,
      error: false,
      errorMessage: ""
    };
  }

  componentWillMount() {
    axios
      .get(config.get("apiurl") + "/faucetinfo")
      .then(response => {
        response.data.etherscanlink =
          response.data.etherscanroot + "/address/" + response.data.account;
        this.setState({ faucetinfo: response.data });
        localStorage.setItem("faucetinfo", response.data);
      })
      .catch(error => {
        if (error.message === "Network Error") {
          this.setState({ errorMessage: "Cannot connect to the server!", error: true });
        }
      });
  }

  render() {
    let { error, errorMessage } = this.state;
    return (
      <div>
        { error ? <section className="error-overlay"><div>{ errorMessage }</div></section> : '' }
        <section className="hero bg-diode">
          <div className="hero-body">
            <div className="container">
              <h1 className="title">Diode Chain™ Faucet</h1>
            </div>
          </div>
        </section>

          <div className="container">
            <FaucetRequest />
          </div>

      </div>
    );
  }
}

export default App;
