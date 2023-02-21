import { LitElement, html, css } from 'lit';
import { render } from 'lit/html.js';
import { Epml } from '../../../../epml';
import {
	use,
	get,
	translate,
	translateUnsafeHTML,
	registerTranslateConfig,
} from 'lit-translate';
import * as actions from '../../components/qdn-action-types';
registerTranslateConfig({
	loader: (lang) => fetch(`/language/${lang}.json`).then((res) => res.json()),
});

import '@material/mwc-button';
import '@material/mwc-icon';
import WebWorker from 'web-worker:./computePowWorkerFile.src.js';
import { publishData } from '../../../utils/publish-image.js';
import { Loader } from '../../../utils/loader.js';
const parentEpml = new Epml({ type: 'WINDOW', source: window.parent });

class WebBrowser extends LitElement {
	static get properties() {
		return {
			url: { type: String },
			name: { type: String },
			service: { type: String },
			identifier: { type: String },
			path: { type: String },
			displayUrl: { type: String },
			followedNames: { type: Array },
			blockedNames: { type: Array },
			theme: { type: String, reflect: true },
		};
	}

	static get observers() {
		return ['_kmxKeyUp(amount)'];
	}

	static get styles() {
		return css`
			* {
				--mdc-theme-primary: rgb(3, 169, 244);
				--mdc-theme-secondary: var(--mdc-theme-primary);
				--paper-input-container-focus-color: var(--mdc-theme-primary);
			}

			#websitesWrapper paper-button {
				float: right;
			}

			#websitesWrapper .buttons {
				width: auto !important;
			}

			.address-bar {
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				height: 100px;
				background-color: var(--white);
				height: 36px;
			}

			.address-bar-button mwc-icon {
				width: 20px;
			}

			.iframe-container {
				position: absolute;
				top: 36px;
				left: 0;
				right: 0;
				bottom: 0;
				border-top: 1px solid var(--black);
			}

			.iframe-container iframe {
				display: block;
				width: 100%;
				height: 100%;
				border: none;
				background-color: var(--white);
			}

			input[type='text'] {
				margin: 0;
				padding: 2px 0 0 20px;
				border: 0;
				height: 34px;
				font-size: 16px;
				background-color: var(--white);
			}

			paper-progress {
				--paper-progress-active-color: var(--mdc-theme-primary);
			}

			.float-right {
				float: right;
			}
		`;
	}

	constructor() {
		super();
		this.url = 'about:blank';
        this.myAddress = window.parent.reduxStore.getState().app.selectedAddress;
		const urlParams = new URLSearchParams(window.location.search);
		this.name = urlParams.get('name');
		this.service = urlParams.get('service');
		this.identifier =
			urlParams.get('identifier') != null
				? urlParams.get('identifier')
				: null;
		this.path =
			urlParams.get('path') != null
				? (urlParams.get('path').startsWith('/') ? '' : '/') +
				  urlParams.get('path')
				: '';
		this.followedNames = [];
		this.blockedNames = [];
		this.theme = localStorage.getItem('qortalTheme')
			? localStorage.getItem('qortalTheme')
			: 'light';
		this.loader = new Loader();
		// Build initial display URL
		let displayUrl = 'qortal://' + this.service + '/' + this.name;
		if (
			this.identifier != null &&
			data.identifier != '' &&
			this.identifier != 'default'
		)
			displayUrl = displayUrl.concat('/' + this.identifier);
		if (this.path != null && this.path != '/')
			displayUrl = displayUrl.concat(this.path);
		this.displayUrl = displayUrl;

		const getFollowedNames = async () => {
			let followedNames = await parentEpml.request('apiCall', {
				url: `/lists/followedNames?apiKey=${this.getApiKey()}`,
			});

			this.followedNames = followedNames;
			setTimeout(
				getFollowedNames,
				this.config.user.nodeSettings.pingInterval
			);
		};

		const getBlockedNames = async () => {
			let blockedNames = await parentEpml.request('apiCall', {
				url: `/lists/blockedNames?apiKey=${this.getApiKey()}`,
			});

			this.blockedNames = blockedNames;
			setTimeout(
				getBlockedNames,
				this.config.user.nodeSettings.pingInterval
			);
		};

		const render = () => {
			const myNode =
				window.parent.reduxStore.getState().app.nodeConfig.knownNodes[
					window.parent.reduxStore.getState().app.nodeConfig.node
				];
			const nodeUrl =
				myNode.protocol + '://' + myNode.domain + ':' + myNode.port;
			this.url = `${nodeUrl}/render/${this.service}/${this.name}${
				this.path != null ? this.path : ''
			}?theme=${this.theme}&identifier=${
				this.identifier != null ? this.identifier : ''
			}`;
		};

		const authorizeAndRender = () => {
			parentEpml
				.request('apiCall', {
					url: `/render/authorize/${
						this.name
					}?apiKey=${this.getApiKey()}`,
					method: 'POST',
				})
				.then((res) => {
					if (res.error) {
						// Authorization problem - API key incorrect?
					} else {
						render();
					}
				});
		};

		let configLoaded = false;

		parentEpml.ready().then(() => {
			parentEpml.subscribe(
				'selected_address',
				async (selectedAddress) => {
					this.selectedAddress = {};
					selectedAddress = JSON.parse(selectedAddress);
					if (
						!selectedAddress ||
						Object.entries(selectedAddress).length === 0
					)
						return;
					this.selectedAddress = selectedAddress;
				}
			);
			parentEpml.subscribe('config', (c) => {
				this.config = JSON.parse(c);
				if (!configLoaded) {
					authorizeAndRender();
					setTimeout(getFollowedNames, 1);
					setTimeout(getBlockedNames, 1);
					configLoaded = true;
				}
			});
			parentEpml.subscribe('copy_menu_switch', async (value) => {
				if (
					value === 'false' &&
					window.getSelection().toString().length !== 0
				) {
					this.clearSelection();
				}
			});
		});
	}

	render() {
		console.log(3, 'browser page here');
		return html`
    		<div id="websitesWrapper" style="width:auto; padding:10px; background: var(--white);">
    			<div class="layout horizontal center">
    				<div class="address-bar">
    					<mwc-button @click=${() => this.goBack()} title="${translate(
			'general.back'
		)}" class="address-bar-button"><mwc-icon>arrow_back_ios</mwc-icon></mwc-button>
    					<mwc-button @click=${() => this.goForward()} title="${translate(
			'browserpage.bchange1'
		)}" class="address-bar-button"><mwc-icon>arrow_forward_ios</mwc-icon></mwc-button>
    					<mwc-button @click=${() => this.refresh()} title="${translate(
			'browserpage.bchange2'
		)}" class="address-bar-button"><mwc-icon>refresh</mwc-icon></mwc-button>
    					<mwc-button @click=${() => this.goBackToList()} title="${translate(
			'browserpage.bchange3'
		)}" class="address-bar-button"><mwc-icon>home</mwc-icon></mwc-button>
    					<input disabled style="width: 550px; color: var(--black);" id="address" type="text" value="${
							this.displayUrl
						}"></input>
    					<mwc-button @click=${() => this.delete()} title="${translate(
			'browserpage.bchange4'
		)} ${this.service} ${this.name} ${translate(
			'browserpage.bchange5'
		)}" class="address-bar-button float-right"><mwc-icon>delete</mwc-icon></mwc-button>
    					${this.renderBlockUnblockButton()}
    					${this.renderFollowUnfollowButton()}
    				</div>
    				<div class="iframe-container">
    					<iframe id="browser-iframe" src="${
							this.url
						}" sandbox="allow-scripts allow-forms allow-downloads">
    						<span style="color: var(--black);">${translate(
								'browserpage.bchange6'
							)}</span>
    					</iframe>
    				</div>
    			</div>
    		</div>
    	`;
	}

	firstUpdated() {
		this.changeTheme();
		this.changeLanguage();

		window.addEventListener('contextmenu', (event) => {
			event.preventDefault();
			this._textMenu(event);
		});

		window.addEventListener('click', () => {
			parentEpml.request('closeCopyTextMenu', null);
		});

		window.addEventListener('storage', () => {
			const checkLanguage = localStorage.getItem('qortalLanguage');
			const checkTheme = localStorage.getItem('qortalTheme');

			use(checkLanguage);

			if (checkTheme === 'dark') {
				this.theme = 'dark';
			} else {
				this.theme = 'light';
			}
			document.querySelector('html').setAttribute('theme', this.theme);
		});

		window.onkeyup = (e) => {
			if (e.keyCode === 27) {
				parentEpml.request('closeCopyTextMenu', null);
			}
		};

		window.addEventListener('message', async (event) => {
			if (
				event == null ||
				event.data == null ||
				event.data.length == 0 ||
				event.data.action == null
			) {
				return;
			}

			let response = '{"error": "Request could not be fulfilled"}';
			let data = event.data;
			console.log('UI received event: ' + JSON.stringify(data));

			switch (data.action) { 
                case 'GET_USER_ACCOUNT':
                case actions.GET_USER_ACCOUNT:
					const res1 = await showModalAndWait(
						actions.GET_USER_ACCOUNT
					);
					if (res1.action === 'accept') {
						let account = {};
						account['address'] = this.selectedAddress.address;
						account['publicKey'] =
							this.selectedAddress.base58PublicKey;
						response = JSON.stringify(account);
						break;
					} else {
						const data = {};
						const errorMsg = get('browserpage.bchange17');
						data['error'] = errorMsg;
						response = JSON.stringify(data);
						return;
					}
				case 'LINK_TO_QDN_RESOURCE':
				case actions.QDN_RESOURCE_DISPLAYED:
					// Links are handled by the core, but the UI also listens for these actions in order to update the address bar.
					// Note: don't update this.url here, as we don't want to force reload the iframe each time.
					let url = 'qortal://' + data.service + '/' + data.name;
					this.path =
						data.path != null
							? (data.path.startsWith('/') ? '' : '/') + data.path
							: null;
					if (
						data.identifier != null &&
						data.identifier != '' &&
						data.identifier != 'default'
					)
						url = url.concat('/' + data.identifier);
					if (this.path != null && this.path != '/')
						url = url.concat(this.path);
					this.name = data.name;
					this.service = data.service;
					this.identifier = data.identifier;
					this.displayUrl = url;
					return;

				case actions.PUBLISH_QDN_RESOURCE:
					// Use "default" if user hasn't specified an identifer
					const service = data.service;
					const name = data.name;
					let identifier = data.identifier;
					const data64 = data.data64;

                    if (!service || !name || !data64) {
						return;
					}
					if (data.identifier == null) {
						identifier = 'default';
					}
					const res2 = await showModalAndWait(
						actions.PUBLISH_QDN_RESOURCE
					);
					if (res2.action === 'accept') {
						const worker = new WebWorker();
						try {
							this.loader.show();
							const resPublish = await publishData({
								registeredName: name,
								file: data64,
								service: service,
								identifier: identifier,
								parentEpml,
								uploadType: 'file',
								selectedAddress: this.selectedAddress,
								worker: worker,
								isBase64: true,
							});
							let data = {};
							data['data'] = resPublish;
							response = JSON.stringify(data);
							worker.terminate();
						} catch (error) {
							worker.terminate();
							const data = {};
							const errorMsg = error.message || 'Upload failed';
							data['error'] = errorMsg;
							response = JSON.stringify(data);
                            console.error(error);
							return;
						} finally {
							this.loader.hide();
						}
					} else if (res2.action === 'reject') {
						response = '{"error": "User declined request"}';
					}
					// Params: data.service, data.name, data.identifier, data.data64,
					// TODO: prompt user for publish. If they confirm, call `POST /arbitrary/{service}/{name}/{identifier}/base64` and sign+process transaction
					// then set the response string from the core to the `response` variable (defined above)
					// If they decline, send back JSON that includes an `error` key, such as `{"error": "User declined request"}`
					break;

				case 'SEND_CHAT_MESSAGE':
					// Params: data.groupId, data.destinationAddress, data.message
					// TODO: prompt user to send chat message. If they confirm, sign+process a CHAT transaction
					// then set the response string from the core to the `response` variable (defined above)
					// If they decline, send back JSON that includes an `error` key, such as `{"error": "User declined request"}`
					break;

				case actions.JOIN_GROUP:
					const groupId = data.groupId;

					if (!groupId) {
						return;
					}

					// Params: data.groupId
					// TODO: prompt user to join group. If they confirm, sign+process a JOIN_GROUP transaction
					// then set the response string from the core to the `response` variable (defined above)
					// If they decline, send back JSON that includes an `error` key, such as `{"error": "User declined request"}`
					break;

				case 'DEPLOY_AT':
					// Params: data.creationBytes, data.name, data.description, data.type, data.tags, data.amount, data.assetId, data.fee
					// TODO: prompt user to deploy an AT. If they confirm, sign+process a DEPLOY_AT transaction
					// then set the response string from the core to the `response` variable (defined above)
					// If they decline, send back JSON that includes an `error` key, such as `{"error": "User declined request"}`
					break;

				case 'GET_WALLET_BALANCE':
					// Params: data.coin (QORT / LTC / DOGE / DGB / C / ARRR)
					// TODO: prompt user to share wallet balance. If they confirm, call `GET /crosschain/:coin/walletbalance`, or for QORT, call `GET /addresses/balance/:address`
					// then set the response string from the core to the `response` variable (defined above)
					// If they decline, send back JSON that includes an `error` key, such as `{"error": "User declined request"}`
                    console.log({data});
                    const res3 = await showModalAndWait(
						actions.GET_WALLET_BALANCE
					);
					if (res3.action === 'accept') {
                    let coin = data.coin;
                        if (coin === "QORT") {
                            let qortAddress = window.parent.reduxStore.getState().app.selectedAddress.address
                            try {
                                this.loader.show();                               
                                const QORTBalance = await parentEpml.request('apiCall', {
                                      url: `/addresses/balance/${qortAddress}?apiKey=${this.getApiKey()}`,
                                  })
                                  console.log({QORTBalance})
                                  return QORTBalance;
                            } catch (error) {
                                console.error(error);
                                const data = {};
                                const errorMsg = error.message || get("browserpage.bchange21");
                                data['error'] = errorMsg;
                                response = JSON.stringify(data);
                                return;
                            } finally {
                                this.loader.hide();
                            }
                        } else {
                            let _url = ``
                            let _body = null

                            switch (coin) {
                                case 'LTC':
                                    _url = `/crosschain/ltc/walletbalance?apiKey=${this.getApiKey()}`
                                    _body = window.parent.reduxStore.getState().app.selectedAddress.ltcWallet.derivedMasterPublicKey
                                    break
                                case 'DOGE':
                                    _url = `/crosschain/doge/walletbalance?apiKey=${this.getApiKey()}`
                                    _body = window.parent.reduxStore.getState().app.selectedAddress.dogeWallet.derivedMasterPublicKey
                                    break
                                case 'DGB':
                                    _url = `/crosschain/dgb/walletbalance?apiKey=${this.getApiKey()}`
                                    _body = window.parent.reduxStore.getState().app.selectedAddress.dgbWallet.derivedMasterPublicKey
                                    break
                                case 'RVN':
                                    _url = `/crosschain/rvn/walletbalance?apiKey=${this.getApiKey()}`
                                    _body = window.parent.reduxStore.getState().app.selectedAddress.rvnWallet.derivedMasterPublicKey
                                    break
                                case 'ARRR':
                                    _url = `/crosschain/arrr/walletbalance?apiKey=${this.getApiKey()}`
                                    _body = window.parent.reduxStore.getState().app.selectedAddress.arrrWallet.seed58
                                    break
                                default:
                                    break
                            }
                                try {
                                    this.loader.show()                                    
                                    await parentEpml.request('apiCall', {
                                        url: _url,
                                        method: 'POST',
                                        body: _body,
                                    }).then((res) => {
                                        if (isNaN(Number(res))) {
                                            throw new Error(get("browserpage.bchange21"));
                                        } else {
                                            console.log((Number(res) / 1e8).toFixed(8), "other wallet balance here");
                                           return (Number(res) / 1e8).toFixed(8)
                                        }
                                    })
                                } catch (error) {                                    
                                    console.error(error);
                                    const data = {};
                                    const errorMsg = error.message || get("browserpage.bchange21");
                                    data['error'] = errorMsg;
                                    response = JSON.stringify(data);
                                    return;
                                } finally {
                                    this.loader.hide()                                    
                                }
                        }
                    } else if (res3.action === 'reject') {
						response = '{"error": "User declined request"}';
					}
					break;

				case 'SEND_COIN':
                    console.log({data});
					// Params: data.coin, data.destinationAddress, data.amount, data.fee
					// TODO: prompt user to send. If they confirm, call `POST /crosschain/:coin/send`, or for QORT, broadcast a PAYMENT transaction
					// then set the response string from the core to the `response` variable (defined above)
					// If they decline, send back JSON that includes an `error` key, such as `{"error": "User declined request"}`
                        const amount = data.amount;
                        let recipient = data.destinationAddress;
                        const fee = data.fee
                        this.loader.show();

                        const walletBalance = await parentEpml.request('apiCall', {
                            url: `/addresses/balance/${this.myAddress.address}?apiKey=${this.getApiKey()}`,
                        }).then((res) => {
                            if (isNaN(Number(res))) {
                                let snack4string = get("chatpage.cchange48")
                                parentEpml.request('showSnackBar', `${snack4string}`)
                                return;
                            } else {
                                return Number(res).toFixed(8);
                            }
                        })

                        const myRef = await parentEpml.request("apiCall", {
                            type: "api",
                            url: `/addresses/lastreference/${this.myAddress.address}`,
                        })

                        if (parseFloat(amount) + parseFloat(data.fee) > parseFloat(walletBalance)) {
                            this.loader.hide();
                            let snack1string = get("chatpage.cchange51");
                            parentEpml.request('showSnackBar', `${snack1string}`);
                            return false;
                        }
                    
                        if (parseFloat(amount) <= 0) {
                            this.loader.hide();
                            let snack2string = get("chatpage.cchange52");
                            parentEpml.request('showSnackBar', `${snack2string}`);
                            return false;
                        }
                    
                        if (recipient.length === 0) {
                            this.loader.hide();
                            let snack3string = get("chatpage.cchange53");
                            parentEpml.request('showSnackBar', `${snack3string}`);
                            return false;
                        }
                    
                        const validateName = async (receiverName) => {
                            let myRes;
                            let myNameRes = await parentEpml.request('apiCall', {
                                type: 'api',
                                url: `/names/${receiverName}`,
                            })
                    
                            if (myNameRes.error === 401) {
                                myRes = false;
                            } else {
                                myRes = myNameRes;
                            }
                            return myRes;
                        }
                    
                        const validateAddress = async (receiverAddress) => {
                            let myAddress = await window.parent.validateAddress(receiverAddress);
                            return myAddress;
                        }
                    
                        const validateReceiver = async (recipient) => {
                            let lastRef = myRef;
                            let isAddress;
                    
                            try {
                                isAddress = await validateAddress(recipient);
                            } catch (err) {
                                isAddress = false;
                            }
                    
                            if (isAddress) {
                                let myTransaction = await makeTransactionRequest(recipient, lastRef);
                                getTxnRequestResponse(myTransaction);
                            } else {
                                let myNameRes = await validateName(recipient);
                                if (myNameRes !== false) {
                                    let myNameAddress = myNameRes.owner
                                    let myTransaction = await makeTransactionRequest(myNameAddress, lastRef)
                                    getTxnRequestResponse(myTransaction)
                                } else {
                                    console.error(`${translate("chatpage.cchange54")}`)
                                    parentEpml.request('showSnackBar', `${translate("chatpage.cchange54")}`)
                                    this.loader.hide();
                                }
                            }
                        }
                    
                        const getName = async (recipient)=> {
                            try {
                                const getNames = await parentEpml.request("apiCall", {
                                type: "api",
                                url: `/names/address/${recipient}`,
                                });
                    
                                if (getNames.length > 0 ) {
                                    return getNames[0].name;
                                } else {
                                    return '';
                                }
                            } catch (error) {
                                return "";
                            }
                        }
                    
                        const makeTransactionRequest = async (receiver, lastRef) => {
                            let myReceiver = receiver;
                            let mylastRef = lastRef;
                            let dialogamount = get("transactions.amount");
                            let dialogAddress = get("login.address");
                            let dialogName = get("login.name");
                            let dialogto = get("transactions.to");
                            let recipientName = await getName(myReceiver);
                            let myTxnrequest = await parentEpml.request('transaction', {
                                type: 2,
                                nonce: this.myAddress.nonce,
                                params: {
                                    recipient: myReceiver,
                                    recipientName: recipientName,
                                    amount: amount,
                                    lastReference: mylastRef,
                                    fee: fee,
                                    dialogamount: dialogamount,
                                    dialogto: dialogto,
                                    dialogAddress,
                                    dialogName
                                },
                            })
                            return myTxnrequest;
                        }
                    
                        const getTxnRequestResponse = (txnResponse) => {
                            if (txnResponse.success === false && txnResponse.message) {
                                parentEpml.request('showSnackBar', `${txnResponse.message}`);
                                this.loader.hide();
                                throw new Error(txnResponse);
                            } else if (txnResponse.success === true && !txnResponse.data.error) {
                                parentEpml.request('showSnackBar', `${get("chatpage.cchange55")}`)
                                this.loader.hide();
                            } else {
                                parentEpml.request('showSnackBar', `${txnResponse.data.message}`);
                                this.loader.hide();
                                throw new Error(txnResponse);
                            }
                        }
                        validateReceiver(recipient);
					break;

				default:
					console.log('Unhandled message: ' + JSON.stringify(data));
					return;
			}

			// Parse response
			let responseObj;
			try {
				responseObj = JSON.parse(response);
			} catch (e) {
				// Not all responses will be JSON
				responseObj = response;
			}

			// Respond to app
			if (responseObj.error != null) {
				event.ports[0].postMessage({
					result: null,
					error: responseObj,
				});
			} else {
				event.ports[0].postMessage({
					result: responseObj,
					error: null,
				});
			}
		});
	}

	changeTheme() {
		const checkTheme = localStorage.getItem('qortalTheme');
		if (checkTheme === 'dark') {
			this.theme = 'dark';
		} else {
			this.theme = 'light';
		}
		document.querySelector('html').setAttribute('theme', this.theme);
	}

	changeLanguage() {
		const checkLanguage = localStorage.getItem('qortalLanguage');

		if (checkLanguage === null || checkLanguage.length === 0) {
			localStorage.setItem('qortalLanguage', 'us');
			use('us');
		} else {
			use(checkLanguage);
		}
	}

	renderFollowUnfollowButton() {
		// Only show the follow/unfollow button if we have permission to modify the list on this node
		if (this.followedNames == null || !Array.isArray(this.followedNames)) {
			return html``;
		}

		if (this.followedNames.indexOf(this.name) === -1) {
			// render follow button
			return html`<mwc-button
				@click=${() => this.follow()}
				title="${translate('browserpage.bchange7')} ${this.name}"
				class="address-bar-button float-right"
				><mwc-icon>add_to_queue</mwc-icon></mwc-button
			>`;
		} else {
			// render unfollow button
			return html`<mwc-button
				@click=${() => this.unfollow()}
				title="${translate('browserpage.bchange8')} ${this.name}"
				class="address-bar-button float-right"
				><mwc-icon>remove_from_queue</mwc-icon></mwc-button
			>`;
		}
	}

	renderBlockUnblockButton() {
		// Only show the block/unblock button if we have permission to modify the list on this node
		if (this.blockedNames == null || !Array.isArray(this.blockedNames)) {
			return html``;
		}

		if (this.blockedNames.indexOf(this.name) === -1) {
			// render block button
			return html`<mwc-button
				@click=${() => this.block()}
				title="${translate('browserpage.bchange9')} ${this.name}"
				class="address-bar-button float-right"
				><mwc-icon>block</mwc-icon></mwc-button
			>`;
		} else {
			// render unblock button
			return html`<mwc-button
				@click=${() => this.unblock()}
				title="${translate('browserpage.bchange10')} ${this.name}"
				class="address-bar-button float-right"
				><mwc-icon>radio_button_unchecked</mwc-icon></mwc-button
			>`;
		}
	}

	// Navigation

	goBack() {
		window.history.back();
	}

	goForward() {
		window.history.forward();
	}

	refresh() {
		const myNode =
			window.parent.reduxStore.getState().app.nodeConfig.knownNodes[
				window.parent.reduxStore.getState().app.nodeConfig.node
			];
		const nodeUrl =
			myNode.protocol + '://' + myNode.domain + ':' + myNode.port;
		this.url = `${nodeUrl}/render/${this.service}/${this.name}${
			this.path != null ? this.path : ''
		}?theme=${this.theme}&identifier=${
			this.identifier != null ? this.identifier : ''
		}`;
	}

	goBackToList() {
		window.location = '../index.html';
	}

	follow() {
		this.followName(this.name);
	}

	unfollow() {
		this.unfollowName(this.name);
	}

	block() {
		this.blockName(this.name);
	}

	unblock() {
		this.unblockName(this.name);
	}

	delete() {
		this.deleteCurrentResource();
	}

	async followName(name) {
		let items = [name];
		let namesJsonString = JSON.stringify({ items: items });

		let ret = await parentEpml.request('apiCall', {
			url: `/lists/followedNames?apiKey=${this.getApiKey()}`,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: `${namesJsonString}`,
		});

		if (ret === true) {
			// Successfully followed - add to local list
			// Remove it first by filtering the list - doing it this way ensures the UI updates
			// immediately, as apposed to only adding if it doesn't already exist
			this.followedNames = this.followedNames.filter(
				(item) => item != name
			);
			this.followedNames.push(name);
		} else {
			let err1string = get('browserpage.bchange11');
			parentEpml.request('showSnackBar', `${err1string}`);
		}

		return ret;
	}

	async unfollowName(name) {
		let items = [name];
		let namesJsonString = JSON.stringify({ items: items });

		let ret = await parentEpml.request('apiCall', {
			url: `/lists/followedNames?apiKey=${this.getApiKey()}`,
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
			},
			body: `${namesJsonString}`,
		});

		if (ret === true) {
			// Successfully unfollowed - remove from local list
			this.followedNames = this.followedNames.filter(
				(item) => item != name
			);
		} else {
			let err2string = get('browserpage.bchange12');
			parentEpml.request('showSnackBar', `${err2string}`);
		}

		return ret;
	}

	async blockName(name) {
		let items = [name];
		let namesJsonString = JSON.stringify({ items: items });

		let ret = await parentEpml.request('apiCall', {
			url: `/lists/blockedNames?apiKey=${this.getApiKey()}`,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: `${namesJsonString}`,
		});

		if (ret === true) {
			// Successfully blocked - add to local list
			// Remove it first by filtering the list - doing it this way ensures the UI updates
			// immediately, as apposed to only adding if it doesn't already exist
			this.blockedNames = this.blockedNames.filter(
				(item) => item != name
			);
			this.blockedNames.push(name);
		} else {
			let err3string = get('browserpage.bchange13');
			parentEpml.request('showSnackBar', `${err3string}`);
		}

		return ret;
	}

	async unblockName(name) {
		let items = [name];
		let namesJsonString = JSON.stringify({ items: items });

		let ret = await parentEpml.request('apiCall', {
			url: `/lists/blockedNames?apiKey=${this.getApiKey()}`,
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
			},
			body: `${namesJsonString}`,
		});

		if (ret === true) {
			// Successfully unblocked - remove from local list
			this.blockedNames = this.blockedNames.filter(
				(item) => item != name
			);
		} else {
			let err4string = get('browserpage.bchange14');
			parentEpml.request('showSnackBar', `${err4string}`);
		}

		return ret;
	}

	async deleteCurrentResource() {
		if (this.followedNames.indexOf(this.name) != -1) {
			// Following name - so deleting won't work
			let err5string = get('browserpage.bchange15');
			parentEpml.request('showSnackBar', `${err5string}`);
			return;
		}

		let identifier =
			this.identifier == null ? 'default' : resource.identifier;

		let ret = await parentEpml.request('apiCall', {
			url: `/arbitrary/resource/${this.service}/${
				this.name
			}/${identifier}?apiKey=${this.getApiKey()}`,
			method: 'DELETE',
		});

		if (ret === true) {
			this.goBackToList();
		} else {
			let err6string = get('browserpage.bchange16');
			parentEpml.request('showSnackBar', `${err6string}`);
		}

		return ret;
	}

	_textMenu(event) {
		const getSelectedText = () => {
			var text = '';
			if (typeof window.getSelection != 'undefined') {
				text = window.getSelection().toString();
			} else if (
				typeof this.shadowRoot.selection != 'undefined' &&
				this.shadowRoot.selection.type == 'Text'
			) {
				text = this.shadowRoot.selection.createRange().text;
			}
			return text;
		};

		const checkSelectedTextAndShowMenu = () => {
			let selectedText = getSelectedText();
			if (selectedText && typeof selectedText === 'string') {
				let _eve = {
					pageX: event.pageX,
					pageY: event.pageY,
					clientX: event.clientX,
					clientY: event.clientY,
				};
				let textMenuObject = {
					selectedText: selectedText,
					eventObject: _eve,
					isFrame: true,
				};
				parentEpml.request('openCopyTextMenu', textMenuObject);
			}
		};
		checkSelectedTextAndShowMenu();
	}

	getApiKey() {
		const myNode =
			window.parent.reduxStore.getState().app.nodeConfig.knownNodes[
				window.parent.reduxStore.getState().app.nodeConfig.node
			];
		let apiKey = myNode.apiKey;
		return apiKey;
	}

	clearSelection() {
		window.getSelection().removeAllRanges();
		window.parent.getSelection().removeAllRanges();
	}
}

window.customElements.define('web-browser', WebBrowser);

async function showModalAndWait(type, data) {
	// Create a new Promise that resolves with user data and an action when the user clicks a button
	return new Promise((resolve) => {
		// Create the modal and add it to the DOM
		const modal = document.createElement('div');
        modal.id = "backdrop"
        modal.classList.add("backdrop");
		modal.innerHTML = 
        ` <div class="modal my-modal-class">
            <div class="modal-content">
                <div class="modal-body">
                    ${type === actions.GET_USER_ACCOUNT ? `<p class="modal-paragraph">${get("browserpage.bchange18")}</p>` : ''}
                    ${type === actions.PUBLISH_QDN_RESOURCE ? `<p class="modal-paragraph">${get("browserpage.bchange19")}</p>` : ''}
                    ${type === actions.GET_WALLET_BALANCE ? `<p class="modal-paragraph">${get("browserpage.bchange20")}</p>` : ''}
                </div>
                <div class="modal-buttons">
                    <button id="cancel-button">Reject</button>
                    <button id="ok-button">Accept</button>
                </div>
            </div>
        </div>
     `;
        document.body.appendChild(modal);

		// Add click event listeners to the buttons
		const okButton = modal.querySelector('#ok-button');
		okButton.addEventListener('click', () => {
			const userData = {};
            if (modal.parentNode === document.body) {
			document.body.removeChild(modal);
            }
			resolve({ action: 'accept', userData });
		});
        const backdropClick = document.getElementById('backdrop');
		backdropClick.addEventListener('click', () => {
            if (modal.parentNode === document.body) {
			document.body.removeChild(modal);
            }
            resolve({ action: 'reject' });
		});
		const cancelButton = modal.querySelector('#cancel-button');
		cancelButton.addEventListener('click', () => {
            if (modal.parentNode === document.body) {
                document.body.removeChild(modal);
            }			
            resolve({ action: 'reject' });
		});
	});
}

// Add the styles for the modal
const styles = `
.backdrop {
position: fixed;
top: 0;
left: 0;
width: 100%;
height: 100%;
background: rgb(186 186 186 / 26%);
overflow: hidden;
animation: backdrop_blur cubic-bezier(0.22, 1, 0.36, 1) 1s forwards; 
z-index: 1000000;
}

@keyframes backdrop_blur {
0% { 
    backdrop-filter: blur(0px);
    background: transparent;
    }
100% { 
    backdrop-filter: blur(5px);
    background: rgb(186 186 186 / 26%);
    }
}

@keyframes modal_transition {
0% {
    visibility: hidden;
    opacity: 0;
}
100% {
    visibility: visible;
    opacity: 1;
}
}

.modal {
position: relative;
display: flex;
justify-content: center;
align-items: center;
width: 100%;
height: 100%;
animation: 1s cubic-bezier(0.22, 1, 0.36, 1) 0s 1 normal forwards running modal_transition;
z-index: 1000001;
}

@keyframes modal_transition {
0% {
    visibility: hidden;
    opacity: 0;
}
100% {
    visibility: visible;
    opacity: 1;
}
}

.modal-content {
background-color: #fff;
border-radius: 10px;
padding: 20px;
box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
max-width: 80%;
min-width: 300px;
display: flex;
flex-direction: column;
justify-content: space-between;
}

.modal-body {
padding: 25px;
}

.modal-paragraph {
font-family: Roboto, sans-serif;
font-size: 18px;
letter-spacing: 0.3px;
font-weight: 300;
color: black;
margin: 0;
}

.modal-buttons {
display: flex;
justify-content: space-between;
margin-top: 20px;
}

.modal-buttons button {
background-color: #4caf50;
border: none;
color: #fff;
padding: 10px 20px;
border-radius: 5px;
cursor: pointer;
transition: background-color 0.2s;
}

.modal-buttons button:hover {
background-color: #3e8e41;
}

#cancel-button {
background-color: #f44336;
}

#cancel-button:hover {
background-color: #d32f2f;
}
`;

const styleSheet = new CSSStyleSheet();
styleSheet.replaceSync(styles);

document.adoptedStyleSheets = [styleSheet];
