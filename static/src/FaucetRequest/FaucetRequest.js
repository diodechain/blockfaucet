import React, { Component } from "react";
import "./FaucetRequest.css";
import Eth from "ethjs";
import config from "react-global-configuration";
import axios from "axios";
import timespan from "timespan";

class FaucetRequest extends Component {
  constructor(props) {
    super(props);
    this.state = {
      address: "",
      tweetUrl: "",
      requestrunning: false,
      tweetText: "",
      twitterUrl: "",
      formError: {
        address: [],
        tweetUrl: []
      }
    };

    this.handleChangeAccount = this.handleChangeAccount.bind(this);
    this.handleChangeTweetUrl = this.handleChangeTweetUrl.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.clearMessages = this.clearMessages.bind(this);
  }

  handleChangeAccount(event) {
    let address = event.target.value;
    let tweetText = `Requesting faucet funds 0.2 diode into ${ address.toLowerCase() } on the #diode_chain test network.`;
    let twitterUrl = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(tweetText);
    this.setState({ address:  address, tweetText: tweetText, twitterUrl: twitterUrl });
  }

  handleChangeTweetUrl(event) {
    this.setState({ tweetUrl: event.target.value });
  }

  clearMessages(event) {
    this.setState({ faucetresponse: null, fauceterror: null });
  }

  validate() {
    let { address, tweetUrl } = this.state;
    let formError = {
      address: [],
      tweetUrl: []
    };
    let isError = false;
    formError.address = [];
    formError.tweetUrl = [];
    if (address.length === 0) {
      formError.address.push("Address is required");
      isError = true;
    } else {
      if (Eth.isAddress(address) !== true) {
        formError.address.push("Wrong diode address");
        isError = true;
      }
    }
    if (tweetUrl.length === 0) {
      formError.tweetUrl.push("Tweet url is required");
      isError = true;
    } else {
      if (/^https:\/\/twitter.com\/([\w\d_]+)\/status\/([\d]+)$/.test(tweetUrl) !== true) {
        formError.tweetUrl.push("Wrong tweet url");
        isError = true;
      }
    }
    this.setState({ formError: formError });
    return !isError;
  }

  handleSubmit(event) {
    this.clearMessages();
    event.preventDefault();
    event.stopPropagation();
    if (this.validate() === false) {
      return;
    }
    if (Eth.isAddress(this.state.address)) {
      this.setState({ requestrunning: true });
      let data = {
        address: this.state.address,
        tweetUrl: this.state.tweetUrl
      };

      let apiUrl = config.get("apiurl") + "/donate";
      axios
        .post(apiUrl, data)
        .then(response => {
          this.setState({ requestrunning: false });
          if (response.status === 200) {
            this.setState({
              faucetresponse: {
                address: response.data.address,
                amount: response.data.amount,
                txhash: response.data.txhash,
                etherscanlink:
                  config.get("etherscanroot") + "/tx/" + response.data.txhash
              }
            });
            return;
          }
        })
        // Catch any error here
        .catch(error => {
          this.setState({ requestrunning: false });
          if (!error || !error.response) {
            this.setState({
              fauceterror: {
                message: 'Error connecting to the API: ' + error.message,
              }
            });
            return;
          }
          if (error.response.status === 403) {
            let t = new timespan.TimeSpan(error.response.data.duration, 0, 0);
            this.setState({
              fauceterror: {
                message: error.response.data.message,
                duration: error.response.data.duration,
                timespan: t
              }
            });
            return;
          }
          if (error.response && error.response.data) {
            this.setState({
              fauceterror: {
                message: 'Error from the server: ' + error.response.data.message,
              }
            });
          }
        });
    } else {
      this.setState({ fauceterror: { message: "invalid address" } });
    }
    event.preventDefault();
  }

  componentDidMount() {
    window.addEventListener("load", () => {
      // See if there is a pubkey on the URL
      let urlTail = window.location.search.substring(1);
      if (Eth.isAddress(urlTail)){
        this.setState({ address: urlTail });
        return;
      }

      // If web3 is not injected (modern browsers)...
      if (typeof window.web3 === "undefined") {
        // Listen for provider injection
        window.addEventListener("message", ({ data }) => {
          if (data && data.type && data.type === "ETHEREUM_PROVIDER_SUCCESS") {
            this.eth = new Eth(window.ethereum);
          }
        });
        // Request provider
        window.postMessage({ type: "ETHEREUM_PROVIDER_REQUEST" }, "*");
      }
      // If web3 is injected (legacy browsers)...
      else {
        this.eth = new Eth(window.web3.currentProvider);
        this.eth
          .accounts()
          .then(accounts => {
            if (accounts && accounts[0]) {
              this.setState({ address: accounts[0] });
            }
          })
          .catch(() => {});
      }
    });
  }

  render() {
    return (
      <div className="">
        <section className="section">
          <div className="container bottompadding">
            <form onSubmit={this.handleSubmit}>
              <div className="field">
                <label className="label">
                  Enter your testnet account address
                </label>
                <div className="control">
                  <input
                    className={this.state.formError.address.length > 0 ? "input is-danger" : "input is-primary"}
                    type="text"
                    placeholder="Enter your testnet account address"
                    value={this.state.address}
                    onChange={this.handleChangeAccount}
                  />
                  { this.state.formError.address.length > 0 ? <p className="is-danger">{this.state.formError.address.join('')}</p> : ''}
                </div>
              </div>
              <div className="field">
                <h3 className="label">Share on <a href={this.state.twitterUrl} target="_blank" rel="noopener noreferrer">Twitter</a> <span>{this.state.tweetText}</span></h3>
              </div>
              <div className="field">
                <label className="label">
                  Copy and paste the tweet URL.
                </label>
                <div className="control">
                  <input
                    className={this.state.formError.tweetUrl.length > 0 ? "input is-danger" : "input is-primary"}
                    type="text"
                    placeholder="Enter tweet url"
                    value={this.state.tweetUrl}
                    onChange={this.handleChangeTweetUrl}
                  />
                  { this.state.formError.tweetUrl.length > 0 ? <p className="is-danger">{this.state.formError.tweetUrl.join('')}</p> : ''}
                </div>
              </div>
              <div className="field is-grouped">
                <div className="control">
                  <button
                    disabled={this.state.requestrunning}
                    className="button btn-diode"
                  >
                    Request diode
                  </button>
                </div>
              </div>
            </form>
          </div>
          {this.state.requestrunning}

          <div className="container">
            {this.state.faucetresponse ? (
              <article
                className="message is-diode"
                // onClick={this.clearMessages}
              >
                <div className="message-body">
                  <p>Test Diode sent to {this.state.faucetresponse.address}.</p>
                  <p>
                    Transaction hash{" "}
                    <a
                      target="_new"
                      href={this.state.faucetresponse.etherscanlink}
                    >
                      {this.state.faucetresponse.txhash}
                    </a>
                  </p>
                </div>
              </article>
            ) : (
              <p />
            )}
            {this.state.fauceterror ? (
              <article
                className="message is-danger"
                onClick={this.clearMessages}
              >
                <div className="message-body">
                <b>{this.state.fauceterror.message}</b><br/>
                  {this.state.fauceterror.timespan ? (
                    <span>
                      You are greylisted for another{" "}
                      {this.state.fauceterror.timespan.hours} hours and{" "}
                      {this.state.fauceterror.timespan.minutes} minutes.
                    </span>
                  ) : (
                    <span />
                  )}
                </div>
              </article>
            ) : (
              <p />
            )}
          </div>
        </section>
      </div>
    );
  }
}

export default FaucetRequest;
