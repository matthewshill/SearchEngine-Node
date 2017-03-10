//	Author: Matt Hill
//	Search Engine using Node.js


//modules
const fs = require('fs');
const path = require('path');
const walk = require('walk');
const commonmark = require('commonmark');
const stemmer = require('stemmer');
const crypto = require('crypto');

//set the Wiki URL with cmd line arguments
const wikiPrefix = process.argv[2];
//walk through markdownfile
const wikiDir = 'wiki/';
const walker = walk.walk('wiki/');
let index = Object.create(null);

//check if markdown file
walker.on('file', function(root, fileStats, next) {
	const fileName = fileStats.name;
	if(fileName.indexOf('.md') !== -1){
		const pathName = path.join(wikiDir, fileName);
		const content = fs.readFileSync(pathName).toString();
		index[fileName] = processFile(fileName, content);
	}
	next();
});

//handle errors
walker.on('end', function() {
	let result = [];
	for (var fileName in index){
		for (var i = 0; i<index[fileName].length; i += 1) {
			result.push(index[fileName][i]);
		}
	}
	console.log(JSON.stringify(result));
});

function contentToMarkdownTree(content) {
	const reader = new commonmark.Parser();
	return reader.parse(content);
}

function processTitle(fileName, tree){
	const cleanFileName = fileName.replace('.md', '');
	const tags = breakIntoTags(cleanFileName);
	return tags;
}

//process content into sections
//keep track of heading and text
function processContent(title, tree) {
	const walker = tree.walker();
	let event, node, child;
	let currentHeading = null;
	let currentText = null;
	let sections = {null: []};

	//walk through tree and check for heading
	 while ((event = walker.next())) {
      node = event.node;
      if (node.type === 'heading') {
        currentHeading = getNodeChildrenText(node);
      } else if (node.literal) {
        const text = node.literal.replace('\n', ' ').toLowerCase();
        if (sections[currentHeading]) {
          sections[currentHeading].push(text);
        } else {
          sections[currentHeading] = [text];
        }
      }
    }

    sections[title] = sections[null];
    delete sections[null];
    return sections;
}

//create heading
function getNodeChildrenText(node) {
	let text = '';
	child = node = node.firstChild;
	do {
		text += child.literal;
	} while ((child = child.next));

	return text;
}

//remove any non-aplha characters and lowercase for consistency
function breakIntoTags(text) {
	let clean = text.replace(/[^a-zA-Z]/g, ' ');
	clean = clean.toLowerCase();
	clean.split(' ');
	let tagsHash = Object.create(null);

	for(var i = 0; i < clean.length; i+=1){
		if(shouldIgnoreWord(clean[i])) {
			continue;
		}
		
		const stemmed = stemmer(clean[i]);
		tagsHash[stemmed] = true;
		tagsHash[clean[i]] = true;
	}

	let tags = [];
	for (var key in tagsHash) {
		if(key.length > 0){
			tags.push(key);
		}
	};

	return tags;
}

function shouldIgnoreWord(text) {
	const stopWords = ['the', 'on', 'for', 'up', 'an', "'", 'to'];
	return text.length === 1 || stopWords.indexOf(text) !== -1;
}

function generateId() {
	const hash = crypto.createHash('sha256'); 
	hash.update.apply(hash, arguments);
	return hash.digest('hex');
}

//process each file
function processFile(fileName, content) {
	let result = [];
	//breakdown title into tags
	const title = fileName.replace('.md', '');
	//const tags = breakIntoTags(title);

	const tree = contentToMarkdownTree(content);
	const tags = processTitle(fileName, tree);
	const processedContent = processContent(title, tree);

	for(var heading in processedContent) {
		const headingTags = breakIntoTags(heading);
		for(var i = 0;i<processedContent[heading].length; i+=1) {
			const item = processedContent[heading][i];
			const subheadingUrl = heading.replace(/\s+/g, '-').replace(/[\/()]/g, '').toLowerCase();
			const id = generateId(title,heading, item.content);

			const titleUrl = `${wikiPrefix}/${title.replace(' ', '-')}`;
			let headingUrlSuffix = heading.toLowerCase().replace(/[\/\(\),.]/g, '').replace(/ /g, '-');
			const data = {
				id: id,
		        title: title,
		        title_url: titleUrl,
		        heading: heading,
		        heading_url: title == heading ? titleUrl : `${titleUrl}#${headingUrlSuffix}`,
		        content: item,
		        tags: tags.concat(breakIntoTags(item)).concat(headingTags)
			};

			result.push(data);
		}

	}
	return result;
}