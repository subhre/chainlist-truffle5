App = {
     web3Provider: null,
     contracts: {},
     account: 0x0,
     loading: false,

     init: async () => {
          return App.initWeb3();
     },

     initWeb3: async () => {
          if(window.ethereum) {
              window.web3 = new Web3(window.ethereum);
              try {
                  await window.ethereum.enable();
                  App.displayAccountInfo();
                  return App.initContract();
              } catch(error) {
                  //user denied access
                  console.error("Unable to retrieve your accounts! You have to approve this application on Metamask");
              }
          } else if(window.web3) {
              window.web3 = new Web3(web3.currentProvider || "ws://localhost:8545");
              App.displayAccountInfo();
              return App.initContract();
          } else {
              //no dapp browser
              console.log("Non-ethereum browser detected. You should consider trying Metamask");
          }
      },

     displayAccountInfo: async () => {
          const accounts = await window.web3.eth.getAccounts();
          App.account = accounts[0];
          $('#account').text(App.account);
          const balance = await window.web3.eth.getBalance(App.account);
          $('#accountBalance').text(window.web3.utils.fromWei(balance, "ether") + " ETH");
     },

     initContract: async () => {
          $.getJSON('ChainList.json', chainListArtifact => {
              App.contracts.ChainList = TruffleContract(chainListArtifact);
              App.contracts.ChainList.setProvider(window.web3.currentProvider);
              App.listenToEvents();
              return App.reloadArticles();
          });
      },

     reloadArticles: async () => {
          //avoid reentry
          if (App.loading) {
               return;
          }
          App.loading = true;

          // refresh account information because the balance might have changed
          App.displayAccountInfo();
          
          try {
               const chainListInstance  = await App.contracts.ChainList.deployed();
               const articleIDs = await chainListInstance.getArticlesForSale();
               
               // retrieve the article placeholder and clear it
               $('#articlesRow').empty();
               
               for (let i = 0; i < articleIDs.length; i++) {
                    const articleID = articleIDs[i];
                    const article = await chainListInstance.articles(articleID);
                    App.displayArticle(article[0], article[1], article[3], article[4], article[5]);
               }

               App.loading = false;
          } catch(err) {
               console.error(err.message);
               App.loading = false;
          };
     },

     displayArticle: async (id, seller, name, description, price) => {
          // retrieve the article placeholder
          const articlesRow = $('#articlesRow');
          
          const etherPrice = web3.utils.fromWei(price, "ether");

          let articleTemplate = $('#articleTemplate');
          articleTemplate.find('.panel-title').text(name);
          articleTemplate.find('.article-description').text(description);
          articleTemplate.find('.article-price').text(etherPrice + " ETH");
          
          // adding metadata to the buy button so we can retrieve it when we click the button
          articleTemplate.find('.btn-buy').attr('data-id', id);
          articleTemplate.find('.btn-buy').attr('data-value', etherPrice);

          // seller
          if (seller == App.account) {
               articleTemplate.find('.article-seller').text("You");
               articleTemplate.find('.btn-buy').hide();
          } else {
               articleTemplate.find('.article-seller').text(seller);
               articleTemplate.find('.btn-buy').show(); 
          }

          // add this new article to the list
          articlesRow.append(articleTemplate.html());
     },

     sellArticle: async () => {
          // retrieve the details of the article from modal dialog
          const _name = $('#article_name').val();
          const _description = $('#article_description').val();
          const articlePriceValue = parseFloat($('#article_price').val());
          const articlePrice = isNaN(articlePriceValue) ? "0" : articlePriceValue.toString();
          const _price = window.web3.utils.toWei(articlePrice, "ether");
          //const _price = window.web3.utils.toWei(parseFloat($('#article_price').val() || 0).toString(), "ether");

          if (_name.trim() == "" || _price === "0") {
               //nothing to sell
               return false;
          }

          try {
               const chainListInstance = await App.contracts.ChainList.deployed();
               const transactionReceipt = await chainListInstance.sellArticle(
                    _name, _description, _price, 
                    {from: App.account, gas: 500000}
               ).on("transactionHash", hash => {
                    console.log("transaction hash", hash);
               });
               console.log("transaction receipt", transactionReceipt);
          } catch(err) {
               console.error(err);
          };
     },

     buyArticle: async () => {
          event.preventDefault();

          // retrieve the article id and price
          const _articleID = $(event.target).data('id');
          const articlePriceValue = parseFloat($(event.target).data('value'));
          const articlePrice = isNaN(articlePriceValue) ? "0" : articlePriceValue.toString();
          const _price = window.web3.utils.toWei(articlePrice, "ether");

          try {
               const chainListInstance = await App.contracts.ChainList.deployed();
               const transactionReceipt = await chainListInstance.buyArticle(_articleID, {
                    from: App.account,
                    value: _price,
                    gas: 500000
               })
               .on("transactionHash", hash => {
                    console.log("transaction hash", hash);
               });

               console.log("transaction receipt", transactionReceipt);
          } catch(err) {
               console.error(err);
          }
     },

     listenToEvents: async () => {
          const chainListInstance = await App.contracts.ChainList.deployed();

          if(App.logSellArticleEventListener == null) {
               App.logSellArticleEventListener = chainListInstance
                    .LogSellArticle({fromBlock: '0'})
                    .on("data", event => {
                         // metamask resends previous events again sometimes (known issue), so remove them
                         // before adding
                         $('#' + event.id).remove();
                         $("#events").append('<li class="list-group-item" id="' + 
                              event.id + '">' + 
                              event.returnValues._name + ' is now for sale</li>');
                         App.reloadArticles();
                    })
                    .on("error", error => {
                         console.error(error);
                    });
          };

          if(App.logBuyArticleEventListener == null) {
               App.logBuyArticleEventListener = chainListInstance
                    .LogBuyArticle({fromBlock: '0'})
                    .on("data", event => {
                         // metamask resends previous events again sometimes (known issue), so remove them
                         // before adding
                         $('#' + event.id).remove();
                         $("#events").append('<li class="list-group-item" id="' + 
                              event.id + '">' + 
                              event.returnValues._buyer + ' bought ' + event.returnValues._name + '</li>');
                         App.reloadArticles();
                    })
                    .on("error", error => {
                         console.error(error);
                    });
          };
     },
};

$(function() {
     $(window).load(function() {
          App.init();
     });
});
