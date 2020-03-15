pragma solidity >0.4.99 < 0.6.0;

import "./Ownable.sol";

contract ChainList is Ownable {
    // custom types
    struct Article {
        uint id;
        address payable seller;
        address buyer;
        string name;
        string description;
        uint256 price;
    }

    // state variables
    mapping (uint => Article) public articles;
    uint articleCounter;

    // events
    event LogSellArticle(
        uint indexed _id,
        address indexed _seller,
        string _name,
        uint256 _price
    );
    event LogBuyArticle(
        uint indexed _id,
        address indexed _seller,
        address indexed _buyer,
        string _name,
        uint256 _price
    );

    // deactivate the contract
    function kill() public onlyOwner {
        selfdestruct(owner);
    }

    // sell an article
    function sellArticle(string memory _name, string memory _description, uint256 _price) public {
        // a new article
        articleCounter++;

        // store this article
        articles[articleCounter] = Article(
            articleCounter,
            msg.sender,
            address(0),
            _name,
            _description,
            _price
        );

        emit LogSellArticle(articleCounter, msg.sender, _name, _price);
    }

    // fetch the number of articles in the contract
    function getNumberOfArticles() public view returns (uint) {
        return articleCounter;
    }

    // fetch and return all article IDs for articles still for sale
    function getArticlesForSale() public view returns (uint[] memory) {
        // prepare output array
        uint[] memory articleIds = new uint[](articleCounter);

        uint numberOfArticlesForSale = 0;
        // iterate over articles
        for (uint i = 1; i <= articleCounter; i++) {
            // keep the ID if the article is still for sale
            if (articles[i].buyer == address(0)) {
                articleIds[numberOfArticlesForSale] = articles[i].id;
                numberOfArticlesForSale++;
            }
        }

        // copy the articleIds array into a smaller forSale array
        uint[] memory forSale = new uint[](numberOfArticlesForSale);
        for (uint j = 0; j < numberOfArticlesForSale; j++) {
            forSale[j] = articleIds[j];
        }

        return forSale;
    }

    function buyArticle(uint _id) public payable {
        // we check whether there is an article for sale
        require(articleCounter > 0, "Article should be available for sale");
        // we check that the article exists
        require(_id > 0 && _id <= articleCounter, "Article with this id does not exist");

        // we need to retrieve the article from the mapping
        Article storage article = articles[_id];

        // check that the article has not been sold yet
        require(article.buyer == address(0), "Article was already sold");
        // we don't allow the seller to buy his own article
        require(msg.sender != article.seller, "Seller cannot buy his own article");
        // check that the value sent corresponds to the price of the article
        require(msg.value == article.price, "Value provided does not match price of article");

        // keep buyer's information
        article.buyer = msg.sender;
        // the buyer can pay the seller
        article.seller.transfer(msg.value);

        // trigger the event
        emit LogBuyArticle(_id, article.seller, article.buyer, article.name, article.price);
    }
}