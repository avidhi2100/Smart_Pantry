const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
const bodyParser = require('body-parser')
const express = require('express')

const ddbClient = new DynamoDBClient({ region: process.env.TABLE_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

let tableName = "recipeTable";
if (process.env.ENV && process.env.ENV !== "NONE") {
  tableName = tableName + '-' + process.env.ENV;
}

const userIdPresent = false; // TODO: update in case is required to use that definition
const partitionKeyName = "recipeID";
const partitionKeyType = "S";
const sortKeyName = "";
const sortKeyType = "";
const hasSortKey = sortKeyName !== "";
const path = "/recrecipes";
const UNAUTH = 'UNAUTH';
const hashKeyPath = '/:' + partitionKeyName;
const sortKeyPath = hasSortKey ? '/:' + sortKeyName : '';

// declare a new express app
const app = express()
app.use(bodyParser.json())
app.use(awsServerlessExpressMiddleware.eventContext())

// Enable CORS for all methods
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "*")
  next()
});

// convert url string param to expected Type
const convertUrlType = (param, type) => {
  switch(type) {
    case "N":
      return Number.parseInt(param);
    default:
      return param;
  }
}
async function getUserPreference (){
  const ddbClient = new DynamoDBClient({ region: 'us-east-1' });
  const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

  var params = {
    TableName: 'userDetails-dev',
    Select: 'ALL_ATTRIBUTES',
  }
  const {Items} = await ddbDocClient.send(new ScanCommand(params));
  const userPerferenceData= Items[0]['userPreferenceData'];
  console.log(userPerferenceData['cuisine']);
  return {
    'cuisine': userPerferenceData['cuisine'],
    'is_veg': userPerferenceData['veg']
  };
}

async function getUserIngredients() {
  const ddbClient = new DynamoDBClient({ region: 'us-east-1' });
  const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
  
  var params = {
    TableName: 'pantryTable-dev',
    Select: 'ALL_ATTRIBUTES',
  }
  const {Items} = await ddbDocClient.send(new ScanCommand(params));
  const labels= Items[0]['LabelsList'];
  console.log(labels);
  return labels;
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}
/************************************
* HTTP Get method to list objects *
************************************/

app.get(path, async function(req, res) {
  const userPerferenceData = await getUserPreference();
    console.log("UserDetails",userPerferenceData);

    // TODO: Replace globalIngredients with MLModel Output Ingredients Data
    const ingredients = await getUserIngredients();
    console.log("Ingredients",ingredients);
    const result = [];

    let filterExpression = 'cuisine = :cuisine and isVeg = :isVeg and ';
    for (let i = 0; i < ingredients.length; i++) {
      filterExpression += 'contains (cleanedIngredients, :item_'+i +')';
      if (i < ingredients.length-1){
        filterExpression += ' or ';
      }
    }

    let expressionAttributeValues = {};
    for (let i = 0; i < ingredients.length; i++) {
      expressionAttributeValues[':item_'+i] = ingredients[i];
    }
    expressionAttributeValues[':cuisine'] = capitalizeFirstLetter(userPerferenceData['cuisine']);
    expressionAttributeValues[':isVeg'] = userPerferenceData['is_veg'].toString().toUpperCase();
  var params = {
      TableName: tableName,
      Select: 'ALL_ATTRIBUTES',
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues
    };
    console.log(params);
    const ingredientsSet = new Set(ingredients);
    const recipes = {};
    const itemsMapping = {};
  try {
      const {Items} = await ddbDocClient.send(new ScanCommand(params));
      console.log(Items);
      for(let i =0; i < Items.length; i++){
      const rowIngredients = Items[i]['cleanedIngredients'].split(",");
      console.log(rowIngredients);

      let matching = 0;
      for(let j =0; j < rowIngredients.length; j++){
        if(ingredientsSet.has(rowIngredients[j])){
          matching +=1;
        }
      }

      recipes[Items[i]['recipeID']] = matching;
      itemsMapping[Items[i]['recipeID']] = Items[i];
      }

      // res.json(Items);
    let RecipeItems = Object.keys(recipes).map(
      (recipeID) => { return [recipeID, recipes[recipeID]] });
    RecipeItems.sort(
      (first, second) => { return second[1] - first[1] }
    );
    const matchingRecipeIds = RecipeItems.map((e) => { return e[0] }).slice(0,3);
    console.log(recipes);
    console.log(matchingRecipeIds);

    const result = matchingRecipeIds.map((recipeId) => {
      let data = itemsMapping[recipeId];
      return {
        'totalTime': data['totalTimeInMins'],
        'recipeName': data['translatedRecipeName'],
        'ingredients' : data['translatedIngredients'],
        'instructions' : data['translatedInstructions'],
        'imageURL': data['imageURL']
      };
    });

    res.json(result);
  } catch (err) {
    res.statusCode = 500;
    res.json({error: 'Could not load items: ' + err.message});
  }
});

/************************************
 * HTTP Get method to query objects *
 ************************************/

app.get(path + hashKeyPath, async function(req, res) {
  const condition = {}
  condition[partitionKeyName] = {
    ComparisonOperator: 'EQ'
  }

  if (userIdPresent && req.apiGateway) {
    condition[partitionKeyName]['AttributeValueList'] = [req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH ];
  } else {
    try {
      condition[partitionKeyName]['AttributeValueList'] = [ convertUrlType(req.params[partitionKeyName], partitionKeyType) ];
    } catch(err) {
      res.statusCode = 500;
      res.json({error: 'Wrong column type ' + err});
    }
  }

  let queryParams = {
    TableName: tableName,
    KeyConditions: condition
  }

  try {
    const data = await ddbDocClient.send(new QueryCommand(queryParams));
    res.json(data.Items);
  } catch (err) {
    res.statusCode = 500;
    res.json({error: 'Could not load items: ' + err.message});
  }
});

/*****************************************
 * HTTP Get method for get single object *
 *****************************************/

app.get(path + '/object' + hashKeyPath + sortKeyPath, async function(req, res) {
  const params = {};
  if (userIdPresent && req.apiGateway) {
    params[partitionKeyName] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
  } else {
    params[partitionKeyName] = req.params[partitionKeyName];
    try {
      params[partitionKeyName] = convertUrlType(req.params[partitionKeyName], partitionKeyType);
    } catch(err) {
      res.statusCode = 500;
      res.json({error: 'Wrong column type ' + err});
    }
  }
  if (hasSortKey) {
    try {
      params[sortKeyName] = convertUrlType(req.params[sortKeyName], sortKeyType);
    } catch(err) {
      res.statusCode = 500;
      res.json({error: 'Wrong column type ' + err});
    }
  }

  let getItemParams = {
    TableName: tableName,
    Key: params
  }

  try {
    const data = await ddbDocClient.send(new GetCommand(getItemParams));
    if (data.Item) {
      res.json(data.Item);
    } else {
      res.json(data) ;
    }
  } catch (err) {
    res.statusCode = 500;
    res.json({error: 'Could not load items: ' + err.message});
  }
});


/************************************
* HTTP put method for insert object *
*************************************/

app.put(path, async function(req, res) {

  if (userIdPresent) {
    req.body['userId'] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
  }

  let putItemParams = {
    TableName: tableName,
    Item: req.body
  }
  try {
    let data = await ddbDocClient.send(new PutCommand(putItemParams));
    res.json({ success: 'put call succeed!', url: req.url, data: data })
  } catch (err) {
    res.statusCode = 500;
    res.json({ error: err, url: req.url, body: req.body });
  }
});

/************************************
* HTTP post method for insert object *
*************************************/

app.post(path, async function(req, res) {

  if (userIdPresent) {
    req.body['userId'] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
  }

  let putItemParams = {
    TableName: tableName,
    Item: req.body
  }
  try {
    let data = await ddbDocClient.send(new PutCommand(putItemParams));
    res.json({ success: 'post call succeed!', url: req.url, data: data })
  } catch (err) {
    res.statusCode = 500;
    res.json({ error: err, url: req.url, body: req.body });
  }
});

/**************************************
* HTTP remove method to delete object *
***************************************/

app.delete(path + '/object' + hashKeyPath + sortKeyPath, async function(req, res) {
  const params = {};
  if (userIdPresent && req.apiGateway) {
    params[partitionKeyName] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
  } else {
    params[partitionKeyName] = req.params[partitionKeyName];
     try {
      params[partitionKeyName] = convertUrlType(req.params[partitionKeyName], partitionKeyType);
    } catch(err) {
      res.statusCode = 500;
      res.json({error: 'Wrong column type ' + err});
    }
  }
  if (hasSortKey) {
    try {
      params[sortKeyName] = convertUrlType(req.params[sortKeyName], sortKeyType);
    } catch(err) {
      res.statusCode = 500;
      res.json({error: 'Wrong column type ' + err});
    }
  }

  let removeItemParams = {
    TableName: tableName,
    Key: params
  }

  try {
    let data = await ddbDocClient.send(new DeleteCommand(removeItemParams));
    res.json({url: req.url, data: data});
  } catch (err) {
    res.statusCode = 500;
    res.json({error: err, url: req.url});
  }
});

app.listen(3000, function() {
  console.log("App started")
});

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app
