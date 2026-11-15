// 程序与艺术 · Tweetable Mathematical Art
// @rank 5
// @votes 120
// @title Mandelbrot 3 x 133 chars
// @author Manuel Kasten
// @url https://codegolf.stackexchange.com/a/35739
// @license CC BY-SA 4.0
// @read u8
//
// The three function bodies below are the first version from Manuel Kasten's answer,
// unchanged. Everything outside the three functions belongs to this repository.
#define TWEET_T unsigned char
#include "tweet.h"
unsigned char GR(int,int);
unsigned char BL(int,int);

unsigned char RD(int i,int j){
   double a=0,b=0,c,d,n=0;
   while((c=a*a)+(d=b*b)<4&&n++<880)
   {b=2*a*b+j*8e-9-.645411;a=c-d+i*8e-9+.356888;}
   return 255*pow((n-80)/800,3.);
}
unsigned char GR(int i,int j){
   double a=0,b=0,c,d,n=0;
   while((c=a*a)+(d=b*b)<4&&n++<880)
   {b=2*a*b+j*8e-9-.645411;a=c-d+i*8e-9+.356888;}
   return 255*pow((n-80)/800,.7);
}
unsigned char BL(int i,int j){
   double a=0,b=0,c,d,n=0;
   while((c=a*a)+(d=b*b)<4&&n++<880)
   {b=2*a*b+j*8e-9-.645411;a=c-d+i*8e-9+.356888;}
   return 255*pow((n-80)/800,.5);
}

TWEET_MAIN(RD, GR, BL)
