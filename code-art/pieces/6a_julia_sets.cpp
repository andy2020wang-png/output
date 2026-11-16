// Tweetable Mathematical Art
// @rank 6
// @votes 110
// @title Julia sets
// @author teh internets is made of catz
// @url https://codegolf.stackexchange.com/a/35674
// @license CC BY-SA 3.0
// @read le16
//
// The three function bodies below are the first version from the answer by
// "teh internets is made of catz", unchanged (10-bit template with the early function names).
// Everything outside the three functions belongs to this repository.
// The samples are read as the 10-bit values the functions return (value / 1023): that is how
// the author's posted picture was made (it matches pixel for pixel).
#define TWEET_T unsigned short
#include "tweet.h"
unsigned short green_fn(int,int);
unsigned short blue_fn(int,int);

unsigned short red_fn(int i, int j){
#define D(x) (x-DIM/2.)/(DIM/2.)
float x=D(i),y=D(j),X,Y,n=0;while(n++<200&&(X=x*x)+(Y=y*y)<4){x=X-Y+.36237;y=2*x*y+.32;}return log(n)*256;}

unsigned short green_fn(int i, int j){
float x=D(i),y=D(j),X,Y,n=0;while(n++<200&&(x*x+y*y)<4){X=x;Y=y;x=X*X-Y*Y+-.7;y=2*X*Y+.27015;}return log(n)*128;}

unsigned short blue_fn(int i, int j){
float x=D(i),y=D(j),X,Y,n=0;while(n++<600&&(x*x+y*y)<4){X=x;Y=y;x=X*X-Y*Y+.36237;y=2*X*Y+.32;}return log(n)*128;}

TWEET_MAIN(red_fn, green_fn, blue_fn)
