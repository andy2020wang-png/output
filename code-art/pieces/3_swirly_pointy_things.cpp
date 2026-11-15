// 程序与艺术 · Tweetable Mathematical Art
// @rank 3
// @votes 162
// @title Some swirly pointy things
// @author cjfaure
// @url https://codegolf.stackexchange.com/a/35689
// @license CC BY-SA 3.0
// @read be16
//
// The three function bodies below are the first version from cjfaure's answer, unchanged.
// Everything outside the three functions belongs to this repository.
// The functions return only 0..6. The 10-bit template writes each sample as two bytes in host
// order (low byte first), while a PPM reader takes the first byte as the high one, so 1, 2, 3
// become 256, 512, 768 out of 1023: the flat colour bands of the picture come from that
// (read this way, the output matches the author's posted picture pixel for pixel).
#define TWEET_T unsigned short
#include "tweet.h"
unsigned short GR(int,int);
unsigned short BL(int,int);

unsigned short RD(int i,int j){
    return(sqrt(_sq(73.-i)+_sq(609-j))+1)/(sqrt(abs(sin((sqrt(_sq(860.-i)+_sq(162-j)))/115.0)))+1)/200;
}
unsigned short GR(int i,int j){
    return(sqrt(_sq(160.-i)+_sq(60-j))+1)/(sqrt(abs(sin((sqrt(_sq(86.-i)+_sq(860-j)))/115.0)))+1)/200;
}
unsigned short BL(int i,int j){
    return(sqrt(_sq(844.-i)+_sq(200-j))+1)/(sqrt(abs(sin((sqrt(_sq(250.-i)+_sq(20-j)))/115.0)))+1)/200;
}

TWEET_MAIN(RD, GR, BL)
