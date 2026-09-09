import urllib.request,urllib.error,http.cookiejar,json,uuid,concurrent.futures
import os
base=os.environ.get('ATELIER_TEST_URL','http://localhost:3000')
def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def call(c,path,body=None,method=None,origin=base):
 headers={'Origin':origin,'Content-Type':'application/json'}
 request=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
 try:
  with c.open(request) as r:return r.status,json.load(r),r.headers
 except urllib.error.HTTPError as r:
  with r:
   raw=r.read()
   try: value=json.loads(raw)
   except ValueError: value={'error':raw.decode(errors='replace')}
   return r.code,value,r.headers
anon=client();a=client();b=client();suffix=uuid.uuid4().hex[:8];pw='A-test-passphrase-unique-'+suffix
assert call(anon,'/api/state?key=progress')[0]==401
assert call(anon,'/api/state',{'key':'progress','data':{},'revision':0},'PUT')[0]==401
assert call(anon,'/api/auth',{'action':'signup','username':'bad','password':pw},origin='https://attacker.example')[0]==403
status,aa,h=call(a,'/api/auth',{'action':'signup','username':'alice_'+suffix,'password':pw});assert status==201,(status,aa);assert 'HttpOnly' in h['Set-Cookie'];recovery=aa['recovery']
status,bb,_=call(b,'/api/auth',{'action':'signup','username':'bob_'+suffix,'password':pw});assert status==201
assert call(a,'/api/state',{'key':'progress','data':{'secret':'alice-only'},'revision':0},'PUT')[0]==200
assert call(b,'/api/state?key=progress')[1]['data'] is None
assert call(b,'/api/state',{'key':'progress','account_id':aa['account']['id'],'data':{'secret':'bob-only'},'revision':0},'PUT')[0]==200
assert call(a,'/api/state?key=progress')[1]['data']['secret']=='alice-only'
assert call(b,'/api/state?key=progress')[1]['data']['secret']=='bob-only'
with concurrent.futures.ThreadPoolExecutor() as ex:
 results=list(ex.map(lambda _:call(a,'/api/state',{'key':'progress','data':{'secret':'alice-new'},'revision':1},'PUT')[0],range(2)))
assert sorted(results)==[200,409],results
assert call(anon,'/api/auth',{'action':'login','username':'alice_'+suffix,'password':pw+'wrong'})[0]==401
assert call(a,'/api/auth',{'action':'claim','code':'not-the-owner-code'})[0]==409
assert call(a,'/api/auth',{'action':'logout'})[0]==200
assert call(a,'/api/state?key=progress')[0]==401
assert call(a,'/api/auth',{'action':'login','username':'alice_'+suffix,'password':pw})[0]==200
reset=client();status,new,_=call(reset,'/api/auth',{'action':'recover','username':'alice_'+suffix,'password':pw+'new','recovery':recovery});assert status==200,new
assert call(a,'/api/state?key=progress')[0]==401
assert call(anon,'/api/auth',{'action':'recover','username':'alice_'+suffix,'password':pw+'again','recovery':recovery})[0]==401
assert call(reset,'/api/state?key=progress')[1]['data']['secret']=='alice-new'
assert call(reset,'/api/state',{'key':'notebook','data':{'entries':{'#learn/request':{'text':'private page note'}}},'revision':0},'PUT')[0]==200
assert call(b,'/api/state?key=notebook')[1]['data'] is None
assert call(reset,'/api/state?key=notebook')[1]['data']['entries']['#learn/request']['text']=='private page note'
print('PASS: notebook persistence and isolation, anonymous denial, CSRF, signup, cookie, two-account isolation, forged owner ignored, CAS, login, logout, recovery and session revocation')

# Both model endpoints reject unauthenticated and unapproved callers before inference.
for endpoint in ['/api/interview','/api/lld-review']:
 assert call(anon,endpoint,{},'POST')[0]==401
 request=urllib.request.Request(base+endpoint,data=b'{}',headers={'Origin':base,'Content-Type':'application/json','X-Atelier-Account':bb['account']['id']},method='POST')
 try:
  b.open(request);raise AssertionError('Unapproved inference allowed')
 except urllib.error.HTTPError as error:
  assert error.code==403,(endpoint,error.code)
print('Model endpoints deny unauthenticated and unapproved accounts')
