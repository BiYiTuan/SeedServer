
var WebSocket = require('ws');
var fs=require('fs');
var path = require("path");

var excludelist=".jpg";//排除文件类型以'|'分隔开
var domain="127.0.0.1";
var rootdir=null; //缺省http服务目录 
var cachedir="p2pcache";		//p2p共享文件目录
var http_port=8001;
var websocket_port=http_port-1;
 
if (rootdir==null){
	rootdir=path.join(__dirname,"home"); 
	let express = require("express");
	let app = express();
	app.use(express.static("home"));
	app.listen(http_port, ()=>{
		console.log("PPeasy seed service start ok...");
		console.log("Admin address: http://127.0.0.1:"+http_port+"/admin");
	});
}
var socketServer = new WebSocket.Server({port: websocket_port, perMessageDeflate: false});

var flist=[];
var chars =['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'];
var writef=0;
fs.readFile('flist.json',function(err,data){
	//console.log(data.toString());
	if(typeof data!='undefined')
	flist=JSON.parse(data.toString());
});
function generateMixed(n) {
	
    var res = "";
    for(var i = 0; i < n ; i ++) {
        var id = Math.floor(Math.random()*16);
		//console.log(id);
		if(id==16) id=15;
        res += chars[id];
    }
    return res;
}
socketServer.on('connection', function(socket, upgradeReq) { 
		socket.send("cfg:"+domain);
        socket.on('close', function(code, message){ 
        });
        socket.onmessage = function(event) { 	 
			if(event.data.substring(0,4)=="del:"){
				writef=1;
				var fi=event.data;
				fi=fi.replace(/\r/g, "");
				fi=fi.split("\n");
				for(var k=1;k<fi.length;k++)
				if(fi[k]!="")
				{
					for(var k2=0;k2<flist.length;k2++)
						if(flist[k2].file==fi[k]){
							flist.splice(k2,1);//flist[k2].status=0; 
							break;
						}
					
				}
				event.target.send("{data:"+JSON.stringify(flist)+"}");
				writef=1;
			}else
			if(event.data.substring(0,4)=="end:"){
				writef=1;
				var fi=event.data;
				fi=fi.replace(/\r/g, "");
				fi=fi.split("\n");
				for(var k=1;k<fi.length;k++)
				if(fi[k]!="")
				{
					for(var k2=0;k2<flist.length;k2++)
						if(flist[k2].file==fi[k]){
							flist[k2].status=0; 
							break;
						}
					
				}
				event.target.send("{data:"+JSON.stringify(flist)+"}");
				writef=1;
			}else
			if(event.data.substring(0,6)=="local:"){
				domain=event.data.substring(6);
				readDirSync(path.join(rootdir,cachedir),path.join(rootdir,cachedir).length);
				event.target.send("{data:"+JSON.stringify(flist)+"}");
				writef=1;
			}else
			if(event.data.substring(0,4)=="url:"){
				writef=1;
				var fi=event.data;
				fi=fi.replace(/\r/g, "");
				fi=fi.split("\n");
				var host=fi[0].substring(4);
				domain=host;
				for(var k=1;k<fi.length;k++)
				if(fi[k]!="")
				{
					flist.push({'Url':fi[k],'file':'p2p://'+host+'/'+generateMixed(16),'status':1,'date':new Date().getTime()});
				}
				event.target.send("{data:"+JSON.stringify(flist)+"}");
			}
			else{
				event.target.send("{data:"+JSON.stringify(flist)+"}");
			} 
        };
});
var sendf=0;
var request = require('request');


setInterval(function(){	
	if(writef)
	{
		writef=0;
		fs.writeFile('flist.json',JSON.stringify(flist),function(err){
			if (err) {res.status(500).send('Server is error...')}
		});
	}
	if(sendf){
		sendf=0;		
		socketServer.clients.forEach(function each(client){
			client.send("{data:"+JSON.stringify(flist)+"}");
		});
	}
},30000);
var http = require('http');
var iplist=[]; 
http.createServer(function (request, response) { 
	
    var rid=request.url.substring(1);
	console.log(rid);
	var rtn="";
	for(var k=0;k<flist.length;k++)
		if((flist[k].status==1||flist[k].status==2) && flist[k].file.indexOf(rid)>=0
			|| flist[k].status==6 && flist[k].file.indexOf(rid)>=0)
		{
			//console.log(flist[k].status);
			if(flist[k].status==6){
				var suburl=flist[k].Url;
				if(path.sep!='/') suburl=suburl.replace(/\\/g,"/");
				rtn+="http://"+domain+":"+http_port+"/"+cachedir+"/"+suburl;
			}
			else
			if(flist[k].status==2){
				rtn+="http://"+domain+":"+http_port+"/"+cachedir+"/"+rid;
			}
			else
			if(flist[k].status==1)
				rtn+=flist[k].Url;
			rtn+="\n";
			rtn+="\nend.";
		}
    response.writeHead(200, {
		'Content-Length': rtn.length,
		//"Access-Control-Allow-Origin":"*",
		'Content-Type': 'text/plain'
		});
    response.end(rtn);
}).listen(65534);
 
function exclude_type(fname){
	for(var k=0;k<excludelist.split("|").length;k++)
	if(fname.substring(fname.length-excludelist.split("|")[k].length)==excludelist.split("|")[k])
		return 1;
	return 0;
}
function readDirSync(path,rootdir_length){
	var pa = fs.readdirSync(path);
	pa.forEach(function(ele,index){
		var info = fs.statSync(path+"\\"+ele)	
		if(info.isDirectory()){ 
			readDirSync(path+"\\"+ele,rootdir_length);
		}else{ 
			//if(ele.indexOf(".")<0 && ele.length==16 && path==rootdir){
			//}else
			if(exclude_type(ele)){
			}else
			{ 
				var fname=path+"\\"+ele;
				fname=fname.substring(rootdir_length+1);
				var findf=0;
				for(var k=0;k<flist.length;k++)
					if(flist[k].Url==fname) findf=1;
				if(!findf)
				{ 
					flist.push({'Url':fname,'file':'p2p://'+domain+'/'+generateMixed(16),'status':6,'date':new Date().getTime()});
				}
			}
		}	
	})
}
process.on('uncaughtException', function (err) { 
  console.log(err); 
  console.log(err.stack);
});
//console.log("start ok");